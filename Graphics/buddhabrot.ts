import * as allofw from "allofw";
import * as allofwutils from "allofw-utils";
import * as zmq from "zmq";
import * as msgpack from "msgpack";

import { GL3 as GL } from "allofw";

let w = new allofw.OpenGLWindow({
    title: "Buddhabrot Renderer",
    width: 800,
    height: 600,
    fullscreen: false
});

import { BuddhabrotRenderer } from "./buddhabrot_renderer";
let buddhabrot = new BuddhabrotRenderer();

w.makeContextCurrent();

let t0 = new Date().getTime();

function render() {
    let t = (new Date().getTime() - t0) / 1000;
    let value = (t / 40) % 1;
value = 0;
    buddhabrot.render({
        theta_xy: value * Math.PI * 2 * 1,
        theta_yz: value * Math.PI * 2 * 2,
        theta_zw: value * Math.PI * 2 * 3,
        theta_zx: value * Math.PI * 2 * 4,
        theta_xw: value * Math.PI * 2 * 5,
        theta_yw: value * Math.PI * 2 * 6,
        x_center: 0,
        x_diff: 1
    });
    let sz = w.getFramebufferSize();
    GL.clear(GL.COLOR_BUFFER_BIT);
    GL.viewport(0, 0, sz[0], sz[1]);
    buddhabrot.composite(0, 0, sz[0], sz[1]);
    w.swapBuffers();
}

w.onRefresh(render)

let timer = setInterval(() => {
    render()
    w.pollEvents();
});
w.onClose(() => {
    clearInterval(timer)
});
