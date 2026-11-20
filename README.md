# 十一月作品手记

[打开作品目录](https://fuyoupeng2007.github.io/prototype-notebook/)。浏览器作品可直接使用内置样例，数字电路实验附有可运行的测试台。

| 方向 | 作品 | 可以试什么 |
| --- | --- | --- |
| 消息与学习 | [接力 Relay](https://fuyoupeng2007.github.io/prototype-notebook/relay/index.html) | 从一条消息建立日程，遇到改期时核对冲突，再导出日历。 |
| 消息与学习 | [续页 Re:Learn](https://fuyoupeng2007.github.io/prototype-notebook/relearn/app/index.html) | 把阅读材料做成回忆题，回到原文自评，并保存下次续学的位置。 |
| 生活工具 | [发前检查](https://fuyoupeng2007.github.io/prototype-notebook/everyday/share.html) | 在示例消息里找出联系方式、地址和取件码，决定哪些字段需要遮盖。 |
| 生活工具 | [爸妈跟着点](https://fuyoupeng2007.github.io/prototype-notebook/everyday/guide.html) | 在模拟手机界面练习操作，记录哪一步容易点错。 |
| 生活工具 | [少跑一趟](https://fuyoupeng2007.github.io/prototype-notebook/everyday/trip.html) | 检查出门办事所需材料，试算补齐某项材料后还有哪些缺口。 |
| 学习实验 | [交付前哨](https://fuyoupeng2007.github.io/prototype-notebook/lab/delivery/index.html) | 对照提交要求检查文件清单，标出仍需确认的条件。 |
| 学习实验 | [误差侦探](https://fuyoupeng2007.github.io/prototype-notebook/lab/lab/index.html) | 分析单摆测量数据，比较拟合结果并检查误差假设。 |
| 学习实验 | [反例工坊](https://fuyoupeng2007.github.io/prototype-notebook/lab/counterexample/index.html) | 运行有限搜索，用具体输入核对算法猜想。 |
| 三维设计 | [Luma 01](https://fuyoupeng2007.github.io/prototype-notebook/luma/Luma-01-viewer.html) | 在浏览器旋转和拆解概念手机模型。查看器需要 WebGL 2。 |
| 数字电路 | [Verilog 数字频率计](frequency-meter/) | 仿真验证频率切换、回卷和复位。 |

## 本地运行

在仓库根目录执行 `python -m http.server 8000 --bind 127.0.0.1`，打开 http://127.0.0.1:8000/ 。接力、续页和学习实验提供可选模型功能，分别进入 `relay`、`relearn` 或 `lab` 目录并运行 `python server.py`，每次启动一个服务。在线体验提供浏览器端功能。

[Luma 01 的 GLB 模型](luma/Luma-01.glb)可下载后导入三维软件。
