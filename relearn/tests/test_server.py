import importlib.util
import json
from pathlib import Path
import unittest
import threading
import urllib.request
import urllib.error
import io
import os
from unittest.mock import patch

path = Path(__file__).resolve().parents[1] / 'server.py'
spec = importlib.util.spec_from_file_location('relearn', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ContractTests(unittest.TestCase):
    def test_compatible_model_response(self):
        text = '线程是操作系统调度的基本单位。同一进程内的线程共享代码段。'
        card = {'title':'线程','summary':'线程用于调度','quote':text,'question':'线程共享哪些资源？','keywords':['线程']}
        response = {'choices':[{'message':{'content':json.dumps({'cards':[card]})}}]}
        env = {'RELEARN_API_KEY':'test-secret-not-real','RELEARN_BASE_URL':'https://model.example/v1','RELEARN_MODEL':'test'}
        with patch.dict(os.environ,env), patch.object(module.urllib.request,'urlopen',return_value=io.BytesIO(json.dumps(response).encode())) as call:
            cards = module.make_plan(text,3)
            self.assertEqual(cards[0]['engine'],'cloud')
            self.assertEqual(call.call_args.args[0].full_url,'https://model.example/v1/chat/completions')
            self.assertEqual(call.call_args.kwargs['timeout'],55)

    def test_provider_errors_do_not_leak_response_or_key(self):
        env = {'RELEARN_API_KEY':'test-secret-not-real','RELEARN_BASE_URL':'https://model.example/v1','RELEARN_MODEL':'test'}
        error = urllib.error.HTTPError('https://model.example/v1',401,'secret body',{},None)
        with patch.dict(os.environ,env), patch.object(module.urllib.request,'urlopen',side_effect=error):
            with self.assertRaises(ValueError) as caught:
                module.make_plan('任意测试资料'*10,3)
            self.assertIn('401',str(caught.exception))
            self.assertNotIn('secret',str(caught.exception))

    def test_evidence_location_is_derived_from_source(self):
        text = '标题\n\n线程是操作系统调度的基本单位。同一进程内的线程共享代码段。'
        card = {'title':'线程','summary':'线程是调度单位','quote':'线程是操作系统调度的基本单位。','question':'复述线程的作用','keywords':['线程','捏造词'],'paragraph':99}
        result = module.validate_cards({'cards':[card]}, text)
        self.assertEqual(result[0]['paragraph'], 2)
        self.assertEqual(result[0]['keywords'], ['线程'])

    def test_fabricated_evidence_rejected(self):
        with self.assertRaises(ValueError):
            module.validate_cards({'cards':[{'title':'a','summary':'b','question':'c','quote':'这是不存在于原始文档中的伪造引文。'}]}, '只有标题和正文。')

    def test_http_contracts(self):
        server = module.ThreadingHTTPServer(('127.0.0.1',0),module.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            with urllib.request.urlopen(base+'/api/status') as r:
                self.assertIn('available', json.load(r))
            with urllib.request.urlopen(base+'/') as r:
                self.assertIn('Re:Learn', r.read().decode())
            request = urllib.request.Request(base+'/api/plan',data=b'{}',headers={'Origin':'https://other.example','Content-Type':'application/json'})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request)
            self.assertEqual(error.exception.code,403)
            error.exception.close()
            request = urllib.request.Request(base+'/api/plan',data=json.dumps({'text':'short','minutes':5}).encode(),headers={'Content-Type':'application/json'})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request)
            self.assertEqual(error.exception.code,400)
            error.exception.close()
        finally:
            server.shutdown()
            server.server_close()

if __name__ == '__main__': unittest.main()
