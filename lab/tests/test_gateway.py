"""Run: python tests/test_gateway.py (no external dependencies)."""
import sys
sys.dont_write_bytecode=True
import importlib.util
import io
import json
import os
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('studio',Path(__file__).resolve().parents[1]/'server.py')
studio=importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)

class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.config_patch=patch.object(studio,'_runtime_config',None,create=True)
        self.config_patch.start()
        self.addCleanup(self.config_patch.stop)

    def test_session_config_is_validated_before_replacing_working_settings(self):
        studio.set_model_config({'base_url':'https://model.example/v1/','model':'study','api_key':'session-secret'})
        self.assertTrue(studio.model_config())
        self.assertEqual(studio.config_status()['base_url'],'https://model.example/v1')
        self.assertNotIn('session-secret',json.dumps(studio.config_status()))
        with self.assertRaises(ValueError):
            studio.set_model_config({'base_url':'http://remote.example/v1','model':'bad','api_key':'new-key'})
        self.assertEqual(studio.config_status()['model'],'study')
        studio.set_model_config({'clear':True})
        self.assertFalse(studio.model_config())

    def test_local_model_can_omit_api_key_and_requests_are_explicit(self):
        body={'choices':[{'message':{'content':json.dumps({'observations':[],'suggestions':[],'uncertainties':[]})}}]}
        with patch.object(studio.urllib.request,'urlopen',return_value=io.BytesIO(json.dumps(body).encode())) as request:
            studio.set_model_config({'base_url':'http://127.0.0.1:11434/v1','model':'local','api_key':''})
            request.assert_not_called()
            studio.explain('lab',{'g':9.8})
            self.assertNotIn('Authorization',request.call_args.args[0].headers)

    def test_config_http_never_returns_secret_and_rejects_foreign_origin(self):
        server=studio.ThreadingHTTPServer(('127.0.0.1',0),studio.Handler)
        worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
        url=f'http://127.0.0.1:{server.server_port}'
        body=json.dumps({'base_url':'https://model.example/v1','model':'test','api_key':'private-test-key'}).encode()
        try:
            request=urllib.request.Request(url+'/api/config',data=body,headers={'Origin':'https://unrelated.example','Content-Type':'application/json'})
            with self.assertRaises(urllib.error.HTTPError) as caught:urllib.request.urlopen(request)
            self.assertEqual(caught.exception.code,403);caught.exception.close()
            self.assertFalse(studio.model_config())
            request=urllib.request.Request(url+'/api/config',data=body,headers={'Origin':url,'Content-Type':'application/json'})
            with urllib.request.urlopen(request) as response:result=response.read().decode()
            self.assertNotIn('private-test-key',result)
            with urllib.request.urlopen(url+'/api/status') as response:status=json.load(response)
            self.assertTrue(status['configured'])
            self.assertEqual(status['source'],'session')
        finally:server.shutdown();server.server_close()

    def test_local_mode_has_no_implicit_model_call(self):
        with patch.dict(os.environ,{},clear=True),patch.object(studio.urllib.request,'urlopen') as request:
            self.assertFalse(studio.model_config())
            with self.assertRaises(ValueError):studio.explain('lab',{})
            request.assert_not_called()

    def test_structured_explanation_with_mock_provider(self):
        result={'observations':['观察到斜率变化'],'suggestions':['复测'],'uncertainties':['不能确定根因']}
        body={'choices':[{'message':{'content':json.dumps(result)}}]}
        env={'STUDIO_API_KEY':'test-only-not-real','STUDIO_BASE_URL':'https://model.example/v1','STUDIO_MODEL':'test'}
        with patch.dict(os.environ,env),patch.object(studio.urllib.request,'urlopen',return_value=io.BytesIO(json.dumps(body).encode())) as request:
            self.assertEqual(studio.explain('lab',{'slope':4}),result)
            self.assertEqual(request.call_args.args[0].full_url,'https://model.example/v1/chat/completions')
            self.assertEqual(request.call_args.kwargs['timeout'],45)

    def test_unstructured_model_response_is_rejected(self):
        body={'choices':[{'message':{'content':'{"observations":"不是数组"}'}}]}
        env={'STUDIO_API_KEY':'test-only','STUDIO_BASE_URL':'https://model.example/v1','STUDIO_MODEL':'test'}
        with patch.dict(os.environ,env),patch.object(studio.urllib.request,'urlopen',return_value=io.BytesIO(json.dumps(body).encode())):
            with self.assertRaises(ValueError):studio.explain('delivery',{})

    def test_non_https_remote_endpoint_is_rejected(self):
        env={'STUDIO_API_KEY':'test-only','STUDIO_BASE_URL':'http://remote.example/v1','STUDIO_MODEL':'test'}
        with patch.dict(os.environ,env),patch.object(studio.urllib.request,'urlopen') as request:
            with self.assertRaises(ValueError):studio.explain('counterexample',{})
            request.assert_not_called()

    def test_http_origin_and_input_contract(self):
        server=studio.ThreadingHTTPServer(('127.0.0.1',0),studio.Handler)
        worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
        url=f'http://127.0.0.1:{server.server_port}'
        try:
            with urllib.request.urlopen(url+'/api/status') as response:self.assertIn('configured',json.load(response))
            request=urllib.request.Request(url+'/api/assist',data=b'{}',headers={'Origin':'https://unrelated.example'})
            with self.assertRaises(urllib.error.HTTPError) as caught:urllib.request.urlopen(request)
            self.assertEqual(caught.exception.code,403);caught.exception.close()
            request=urllib.request.Request(url+'/api/assist',data=b'{}',headers={'Origin':url})
            with self.assertRaises(urllib.error.HTTPError) as caught:urllib.request.urlopen(request)
            self.assertEqual(caught.exception.code,400);caught.exception.close()
        finally:server.shutdown();server.server_close()

if __name__=='__main__':unittest.main()
