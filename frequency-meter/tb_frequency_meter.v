`timescale 1ns/1ps

module tb_frequency_meter;
    reg clk_ref = 1'b0;
    reg signal_in = 1'b0;
    reg rst_n = 1'b1;
    integer frequency_hz = 100;
    integer wrap_checks = 0;
    wire [15:0] bcd_out;
    wire valid;

    frequency_meter dut (clk_ref, signal_in, rst_n, bcd_out, valid);

    always #500_000_000 clk_ref = ~clk_ref;
    always begin
        #(500_000_000.0 / frequency_hz);
        signal_in = ~signal_in;
    end

    initial begin
        $timeformat(-9, 0, " ns", 0);
        $dumpfile("frequency_meter.vcd");
        $dumpvars(1, tb_frequency_meter);
        $dumpvars(1, dut);
        $dumpvars(1, dut.counter);
        #1 rst_n = 1'b0;
        #122_999_999 rst_n = 1'b1;
        #(64'd6_127_000_000) frequency_hz = 1234;
        #(64'd4_000_000_000) frequency_hz = 9999;
        #(64'd4_850_000_000) rst_n = 1'b0;
        #200_000_000 rst_n = 1'b1;
    end

    always @(negedge rst_n) begin
        #1;
        if (bcd_out !== 16'h0000 || valid !== 1'b0)
            $fatal(1, "Reset failed at %t", $time);
        $display("PASS  reset -> BCD=0000, valid=0  @ %t", $time);
    end

    always @(posedge clk_ref) begin
        if (valid && dut.sample_count < dut.previous) begin
            wrap_checks = wrap_checks + 1;
            $display("PASS  wrap observed: %0d -> %0d, delta=%0d  @ %t",
                     dut.previous, dut.sample_count, dut.delta, $time);
        end
    end

    task expect_reading;
        input [15:0] expected;
        input integer hz;
        begin
            #1;
            if (valid !== 1'b1 || bcd_out !== expected)
                $fatal(1, "At %t, expected %h but got %h (valid=%b)",
                       $time, expected, bcd_out, valid);
            $display("PASS  %4d Hz -> BCD=%h, valid=1  @ %t", hz, bcd_out, $time);
        end
    endtask

    initial begin
        repeat (5) @(posedge clk_ref);
        #1;
        if (valid !== 1'b0 || bcd_out !== 16'h0000)
            $fatal(1, "Display updated before two samples were available");
        @(posedge clk_ref); expect_reading(16'h0100, 100);
        @(posedge clk_ref); expect_reading(16'h0100, 100);
        repeat (3) @(posedge clk_ref); expect_reading(16'h1234, 1234);
        @(posedge clk_ref); expect_reading(16'h1234, 1234);
        repeat (3) @(posedge clk_ref); expect_reading(16'h9999, 9999);
        @(posedge clk_ref); expect_reading(16'h9999, 9999);
        @(negedge rst_n);
        repeat (5) @(posedge clk_ref);
        #1;
        if (valid !== 1'b0 || bcd_out !== 16'h0000)
            $fatal(1, "Display updated too early after reset");
        @(posedge clk_ref); expect_reading(16'h9999, 9999);
        if (wrap_checks == 0)
            $fatal(1, "The counter did not wrap during the test");
        #900_000_000;
        if (valid !== 1'b1 || bcd_out !== 16'h9999)
            $fatal(1, "Display did not hold between reference rising edges");
        $display("ALL TESTS PASSED");
        $finish;
    end
endmodule
