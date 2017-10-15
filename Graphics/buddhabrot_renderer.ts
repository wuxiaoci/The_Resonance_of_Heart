import * as allofw from "allofw";
import * as allofwutils from "allofw-utils";
import * as zmq from "zmq";
import * as msgpack from "msgpack";

import { GL3 as GL, graphics } from "allofw";

let vertex_shader = `
#version 330
layout(location = 0) in vec4 sample;
out vec4 samples;
void main() {
    samples = sample;
}
`;

let geometry_shader = `
#version 330

const int max_iteration = 4;

layout(points) in;
layout(triangle_strip, max_vertices = 16) out;

uniform float time      = 0;
uniform float theta_xy     = 0;
uniform float theta_yz     = 0;
uniform float theta_zx     = 0;
uniform float theta_xw     = 0;
uniform float theta_yw     = 0;
uniform float theta_zw     = 0;
uniform float x_center  = 0;
uniform float x_diff    = 0;



in vec4 samples[1];

out vec2 vpos;

void main() {
    vec2 c = samples[0].xy;
    vec2 z0 = samples[0].zw;

    float scale = x_diff;

    // Static Buddha
    vec4 e1 = vec4(1, 0, 0, 0) / 2 * scale;
    vec4 e2 = vec4(0, 1, 0, 0) / 2 * scale;

    mat4 m_xy = mat4(
        vec4(cos(theta_xy), sin(theta_xy), 0, 0),
        vec4(-sin(theta_xy), cos(theta_xy), 0, 0),
        vec4(0, 0, 1, 0),
        vec4(0, 0, 0, 1)
    );
    mat4 m_yz = mat4(
        vec4(1, 0, 0, 0),
        vec4(0, cos(theta_yz), sin(theta_yz), 0),
        vec4(0, -sin(theta_yz), cos(theta_yz), 0),
        vec4(0, 0, 0, 1)
    );
    mat4 m_zw = mat4(
        vec4(1, 0, 0, 0),
        vec4(0, 1, 0, 0),
        vec4(0, 0, cos(theta_zw), sin(theta_zw)),
        vec4(0, 0, -sin(theta_zw), cos(theta_zw))
    );
    mat4 m_zx = mat4(
        vec4(cos(theta_zx), 0, sin(theta_zx), 0),
        vec4(0, 1, 0, 0),
        vec4(-sin(theta_zx), 0, cos(theta_zx), 0),
        vec4(0, 0, 0, 1)
    );
    mat4 m_xw = mat4(
        vec4(cos(theta_xw), 0, 0, sin(theta_xw)),
        vec4(0, 1, 0, 0),
        vec4(0, 0, 1, 0),
        vec4(-sin(theta_xw), 0, 0, cos(theta_xw))
    );
    mat4 m_yw = mat4(
        vec4(1, 0, 0, 0),
        vec4(0, cos(theta_yw), 0, sin(theta_yw)),
        vec4(0, 0, 1, 0),
        vec4(0, -sin(theta_yw), 0, cos(theta_yw))
    );

    mat4 mat = m_xy * m_yz * m_zw * m_zx * m_xw * m_yw;

    e1 = mat * e1;
    e2 = mat * e2;

    vec4 cz = vec4(0, 0, 0, 0);
    cz.zw = c;

    const float pixel_size_x = 1.0 / 4096.0;
    const float pixel_size_y = 1.0 / 4096.0;

    vec2 z = z0;
    int t = 0;
    while(t < max_iteration) {
        cz.xy = z;
        vec4 pos = vec4(dot(cz, e1), dot(cz, e2), 0, 1);
        gl_Position = pos + vec4(pixel_size_x, pixel_size_y, 0, 0);
        vpos = vec2(1, 1);
        EmitVertex();
        gl_Position = pos + vec4(-pixel_size_x, pixel_size_y, 0, 0);
        vpos = vec2(1, -1);
        EmitVertex();
        gl_Position = pos + vec4(pixel_size_x, -pixel_size_y, 0, 0);
        vpos = vec2(-1, 1);
        EmitVertex();
        gl_Position = pos + vec4(-pixel_size_x, -pixel_size_y, 0, 0);
        vpos = vec2(-1, -1);
        EmitVertex();
        EndPrimitive();

        z = vec2(z.x * z.x - z.y * z.y, z.x * z.y * 2.0) + c;
        t += 1;
    }
}
`

let fragment_shader = `
#version 330
layout(location = 0) out vec4 fragment_output;
uniform float scaler;
in vec2 vpos;
void main() {
    float v = scaler * 16;
    fragment_output = vec4(v, v, v, 1);
}
`

let composite_vertex_shader = `
#version 330
uniform float x_scale;
uniform float y_scale;
layout(location = 0) in vec2 pos;
out vec2 tex_coord;
void main() {
    tex_coord = vec2(1.0 - pos.y, pos.x);
    gl_Position = vec4(pos * 2.0 - 1.0, 0, 1);
    gl_Position.x *= x_scale;
    gl_Position.y *= y_scale;
}
`

let composite_fragment_shader = `
#version 330
uniform sampler2D texCounter;
uniform sampler2D texColormap;
uniform float max_counter;
in vec2 tex_coord;
layout(location = 0) out vec4 fragment_output;
void main() {
    vec4 counter = texture(texCounter, tex_coord);
    float v = counter.r / max_counter;
    float p = 1 - 1 / (1 + v);
    p = pow(p, 0.3);
    fragment_output = texture(texColormap, vec2(p, 0.5));
    // fragment_output = vec4(p, p, p, 1);
}
`

export class BuddhabrotRenderer {
    constructor() {
        this.setupRender();
        this.setupBuffers();
    }

    private framebuffer_size: number = 4096;
    private framebuffer: GL.Framebuffer;
    private program: GL.Program;
    private framebuffer_texture: GL.Texture;
    private program_composite: GL.Program;
    private vertex_array: GL.VertexArray;
    private quad_array: GL.VertexArray;
    private point_size: number = 1;
    private vertices: number;
    private colormap_image: graphics.Surface2D;

    private setupBuffers() {
        let vertex_buffer = new GL.Buffer();
        this.vertex_array = new GL.VertexArray();
        let buffer = require("fs").readFileSync("data.bin");
        this.vertices = buffer.length / 4 / 4;
        // this.vertices /= 4;

        console.log("Number of vertices:", this.vertices);

        GL.bindBuffer(GL.ARRAY_BUFFER, vertex_buffer);
        GL.bufferData(GL.ARRAY_BUFFER, buffer.length, buffer, GL.STATIC_DRAW);

        GL.bindVertexArray(this.vertex_array);
        GL.enableVertexAttribArray(0);
        GL.bindBuffer(GL.ARRAY_BUFFER, vertex_buffer);
        GL.vertexAttribPointer(0, 4, GL.FLOAT, GL.FALSE, 16, 0);
        GL.bindBuffer(GL.ARRAY_BUFFER, 0);
        GL.bindVertexArray(0);

        this.framebuffer = new GL.Framebuffer();
        this.framebuffer_texture = new GL.Texture();

        GL.bindTexture(GL.TEXTURE_2D, this.framebuffer_texture);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_LINEAR);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA32F, this.framebuffer_size, this.framebuffer_size, 0, GL.RGBA, GL.FLOAT, 0);
        GL.bindTexture(GL.TEXTURE_2D, 0);

        GL.bindFramebuffer(GL.FRAMEBUFFER, this.framebuffer);
        GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, this.framebuffer_texture, 0);
        let s = GL.checkFramebufferStatus(GL.FRAMEBUFFER);
        if (s != GL.FRAMEBUFFER_COMPLETE) {
            console.log("Framebuffer incomplete:", s);
        }
        GL.bindFramebuffer(GL.FRAMEBUFFER, 0);

        let quad_buffer = new GL.Buffer();
        this.quad_array = new GL.VertexArray();

        buffer = new Buffer(4 * 8);
        buffer.writeFloatLE(0, 0 * 4);
        buffer.writeFloatLE(0, 1 * 4);
        buffer.writeFloatLE(0, 2 * 4);
        buffer.writeFloatLE(1, 3 * 4);
        buffer.writeFloatLE(1, 4 * 4);
        buffer.writeFloatLE(0, 5 * 4);
        buffer.writeFloatLE(1, 6 * 4);
        buffer.writeFloatLE(1, 7 * 4);

        GL.bindBuffer(GL.ARRAY_BUFFER, quad_buffer);
        GL.bufferData(GL.ARRAY_BUFFER, buffer.length, buffer, GL.STATIC_DRAW);

        GL.bindVertexArray(this.quad_array);
        GL.enableVertexAttribArray(0);
        GL.bindBuffer(GL.ARRAY_BUFFER, quad_buffer);
        GL.vertexAttribPointer(0, 2, GL.FLOAT, GL.FALSE, 8, 0);
        GL.bindBuffer(GL.ARRAY_BUFFER, 0);
        GL.bindVertexArray(0);

        this.colormap_image = graphics.loadImageData(require("fs").readFileSync(__dirname + "/gradient.png"));;
        this.colormap_image.uploadTexture();
    }

    private setupRender() {
        this.program = allofwutils.compileShaders({
            vertex: vertex_shader,
            geometry: geometry_shader,
            fragment: fragment_shader
        });
        this.program_composite = allofwutils.compileShaders({
            vertex: composite_vertex_shader,
            fragment: composite_fragment_shader
        });
        GL.useProgram(this.program_composite);
        GL.uniform1i(GL.getUniformLocation(this.program_composite, "texCounter"), 0);
        GL.uniform1i(GL.getUniformLocation(this.program_composite, "texColormap"), 1);
        GL.useProgram(0);
    }

    public render(parameters: { [name: string]: number } = {}) {
        GL.disable(GL.DEPTH_TEST)
        GL.depthMask(GL.FALSE)

        GL.bindFramebuffer(GL.FRAMEBUFFER, this.framebuffer)
        GL.viewport(0, 0, this.framebuffer_size, this.framebuffer_size)
        GL.clear(GL.COLOR_BUFFER_BIT)
        GL.enable(GL.BLEND);
        GL.blendFunc(GL.ONE, GL.ONE);
        GL.useProgram(this.program)


        for (let key in parameters) {
            GL.uniform1f(GL.getUniformLocation(this.program, key), parameters[key]);
        }

        GL.bindVertexArray(this.vertex_array)
        GL.pointSize(this.point_size);
        GL.uniform1f(GL.getUniformLocation(this.program, "scaler"), 1)
        GL.drawArrays(GL.POINTS, 0, this.vertices)
        // GL.pointSize(point_size * 8);
        // GL.uniform1f(GL.getUniformLocation(program, "scaler"), 1.0 / 0.004291541401937571 / 64)
        // GL.drawArrays(GL.POINTS, vertices / 2, vertices / 2 / 8)
        GL.bindVertexArray(0)
        GL.useProgram(0)
        GL.bindFramebuffer(GL.FRAMEBUFFER, 0)
        GL.bindTexture(GL.TEXTURE_2D, this.framebuffer_texture)
        GL.generateMipmap(GL.TEXTURE_2D)
        GL.bindTexture(GL.TEXTURE_2D, 0)
    }

    public composite(x: number, y: number, width: number, height: number) {
        GL.clear(GL.COLOR_BUFFER_BIT);
        GL.viewport(x, y, width, height);
        GL.useProgram(this.program_composite);

        let pixel_size = 1024 * 1024 * (this.point_size * this.point_size) / (this.framebuffer_size * this.framebuffer_size);
        GL.uniform1f(GL.getUniformLocation(this.program_composite, "max_counter"), pixel_size * this.vertices / 100);
        let x_scale: number, y_scale: number;
        if (width < height) {
            y_scale = width / height;
            x_scale = 1;
        } else {
            x_scale = height / width;
            y_scale = 1;
        }
        GL.uniform1f(GL.getUniformLocation(this.program_composite, "y_scale"), y_scale);
        GL.uniform1f(GL.getUniformLocation(this.program_composite, "x_scale"), x_scale);
        GL.disable(GL.BLEND);

        GL.bindVertexArray(this.quad_array)
        GL.activeTexture(GL.TEXTURE0)
        GL.bindTexture(GL.TEXTURE_2D, this.framebuffer_texture)
        this.colormap_image.bindTexture(1)
        GL.activeTexture(GL.TEXTURE1)
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        GL.drawArrays(GL.TRIANGLE_STRIP, 0, 4)
        this.colormap_image.unbindTexture(1)
        GL.activeTexture(GL.TEXTURE0)
        GL.bindTexture(GL.TEXTURE_2D, 0)
        GL.bindVertexArray(0)
        GL.useProgram(0)
    }
}