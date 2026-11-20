# Verilog 数字频率计

以参考时钟采样格雷码计数器，将相邻样本的脉冲数转换为四位 BCD。测试台使用 1 Hz 参考时钟，检查 100、1234、9999 Hz 输入、跨计数器回卷以及复位后的首次有效读数。

使用 Icarus Verilog 运行仿真：

```sh
iverilog -g2012 -s tb_frequency_meter -o meter frequency_meter.v tb_frequency_meter.v
vvp meter
```

通过后打印 `ALL TESTS PASSED`，生成的 `frequency_meter.vcd` 可用 GTKWave 查看。
