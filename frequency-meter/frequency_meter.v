`timescale 1ns/1ps

module frequency_meter (
    input  wire        clk_ref,
    input  wire        signal_in,
    input  wire        rst_n,
    output reg  [15:0] bcd_out,
    output reg         valid
);
    localparam [1:0] FILL_1 = 2'd0, FILL_2 = 2'd1,
                     BASELINE = 2'd2, MEASURE = 2'd3;

    wire ref_run_n, signal_run_n;
    wire [13:0] gray_count;
    (* ASYNC_REG = "TRUE" *) reg [13:0] gray_meta, gray_sync;
    reg [1:0] state;
    reg [13:0] previous;
    wire [13:0] sample_count, delta, display_count;
    wire [15:0] next_bcd;

    reset_release ref_reset(clk_ref, rst_n, ref_run_n);
    reset_release signal_reset(signal_in, rst_n, signal_run_n);
    pulse_counter counter(signal_in, signal_run_n, gray_count);
    binary_to_bcd converter(display_count, next_bcd);

    function [13:0] gray_to_binary;
        input [13:0] gray;
        integer bit_index;
        begin
            gray_to_binary[13] = gray[13];
            for (bit_index = 12; bit_index >= 0; bit_index = bit_index - 1)
                gray_to_binary[bit_index] =
                    gray_to_binary[bit_index + 1] ^ gray[bit_index];
        end
    endfunction

    assign sample_count = gray_to_binary(gray_sync);
    // The fixed width implements subtraction modulo 16384.
    assign delta = sample_count - previous;
    assign display_count = (delta > 14'd9999) ? 14'd9999 : delta;

    always @(posedge clk_ref or negedge ref_run_n) begin
        if (!ref_run_n) begin
            gray_meta <= 14'd0;
            gray_sync <= 14'd0;
        end else begin
            gray_meta <= gray_count;
            gray_sync <= gray_meta;
        end
    end

    always @(posedge clk_ref or negedge ref_run_n) begin
        if (!ref_run_n) begin
            state    <= FILL_1;
            previous <= 14'd0;
            bcd_out  <= 16'h0000;
            valid    <= 1'b0;
        end else begin
            case (state)
                FILL_1: state <= FILL_2;
                FILL_2: state <= BASELINE;
                BASELINE: begin
                    previous <= sample_count;
                    state    <= MEASURE;
                end
                MEASURE: begin
                    previous <= sample_count;
                    bcd_out  <= next_bcd;
                    valid    <= 1'b1;
                end
                default: state <= FILL_1;
            endcase
        end
    end
endmodule

module reset_release (
    input  wire clk,
    input  wire rst_n,
    output wire run_n
);
    (* ASYNC_REG = "TRUE" *) reg [1:0] release_pipe;
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            release_pipe <= 2'b00;
        else
            release_pipe <= {release_pipe[0], 1'b1};
    end
    assign run_n = release_pipe[1];
endmodule

module pulse_counter (
    input  wire        signal_in,
    input  wire        run_n,
    output reg  [13:0] gray_count
);
    reg  [13:0] count;
    wire [13:0] count_next = count + 14'd1;

    always @(posedge signal_in or negedge run_n) begin
        if (!run_n) begin
            count      <= 14'd0;
            gray_count <= 14'd0;
        end else begin
            count      <= count_next;
            gray_count <= count_next ^ (count_next >> 1);
        end
    end
endmodule

module binary_to_bcd (
    input  wire [13:0] binary,
    output reg  [15:0] bcd
);
    integer bit_index, digit_index;
    always @* begin
        bcd = 16'h0000;
        for (bit_index = 13; bit_index >= 0; bit_index = bit_index - 1) begin
            for (digit_index = 0; digit_index < 4; digit_index = digit_index + 1)
                if (bcd[digit_index*4 +: 4] >= 4'd5)
                    bcd[digit_index*4 +: 4] = bcd[digit_index*4 +: 4] + 4'd3;
            bcd = {bcd[14:0], binary[bit_index]};
        end
    end
endmodule
