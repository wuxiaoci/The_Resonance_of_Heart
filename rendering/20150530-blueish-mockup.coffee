allofw = require "allofw"
zmq = require "zmq"
msgpack = require "msgpack"

parameters = {
    theta_xy: 0,
    theta_yz: 0,
    theta_zx: 0,
    theta_xw: 0,
    theta_yw: 0,
    theta_zw: 0,
    x_center: 0,
    x_diff: 0,
    color_phase: 0.5
}

zmq_sub = zmq.socket("sub")
zmq_sub.connect("tcp://192.168.1.107:60070")
zmq_sub.subscribe("")
zmq_sub.on("message", (buffer) ->
    state = msgpack.unpack(buffer)
    distance = (a, b) -> Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]))
    subtract = (a, b) -> [ a[0] - b[0], a[1] - b[1], a[2] - b[2] ]
    parameters['x_center'] = (state.left.position[0] + state.right.position[0]) / 200

    v1x = state.left.normal[0]
    v1y = state.left.normal[1]
    v1z = state.left.normal[2]
    v1l = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z) + 1e-10
    v1x /= v1l
    v1y /= v1l
    v1z /= v1l

    v2x = state.right.normal[0]
    v2y = state.right.normal[1]
    v2z = state.right.normal[2]
    v2l = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z) + 1e-10
    v2x /= v2l
    v2y /= v2l
    v2z /= v2l

    vnx = state.left.position[0] - state.right.position[0]
    vny = state.left.position[1] - state.right.position[1]
    vnz = state.left.position[2] - state.right.position[2]
    vnl = Math.sqrt(vnx * vnx + vny * vny + vnz * vnz) + 1e-10
    vnx /= vnl
    vny /= vnl
    vnz /= vnl

    angle = v1x * v2x + v1y * v2y + v1z * v2z
    angle2 = -(Math.atan2(vnx, vnz) + Math.PI / 2) * 2;
    angle3 = -(Math.atan2(vnx, vny) + Math.PI / 2) * 2;
    x_diff = distance(state.left.position, state.right.position) / 200
    if state.left.seen || state.right.seen
        target_angle = angle
        target_angle2 = angle2
        target_angle3 = angle3
        target_xdiff = x_diff
    else
        target_angle = 0
        target_angle2 = 0
        target_angle3 = 0
        target_xdiff = 1

    parameters['color_phase'] = Math.sin(new Date().getTime() / 1000) * 0.5 + 0.5
    parameters['theta_xw'] = parameters['theta_xw'] * 0.95 + target_angle * 0.05
    parameters['theta_yw'] = parameters['theta_yw'] * 0.95 + target_angle2 * 0.05
    parameters['theta_zw'] = parameters['theta_zw'] * 0.95 + target_angle3 * 0.05
    parameters['x_diff'] = parameters['x_diff'] * 0.95 + target_xdiff * 0.05
)

GL = allofw.GL3
graphics = allofw.graphics

w = new allofw.OpenGLWindow({ title: "Buddhabrot Renderer", fullscreen: false })
w.makeContextCurrent()

vertex_shader = """
    #version 330
    layout(location = 0) in vec4 sample;
    out vec2 cs;
    out vec2 z0s;
    void main() {
        cs = sample.xy;
        z0s = sample.zw;
    }
"""

geometry_shader = """
    #version 330
    layout(points) in;
    layout(points, max_vertices = 256) out;

    uniform float time      = 0;
    uniform float theta_xy     = 0;
    uniform float theta_yz     = 0;
    uniform float theta_zx     = 0;
    uniform float theta_xw     = 0;
    uniform float theta_yw     = 0;
    uniform float theta_zw     = 0;
    uniform float x_center  = 0;
    uniform float x_diff    = 0;

    const int max_iteration = 256;

    in vec2 cs[1];
    in vec2 z0s[1];

    void main() {
        vec2 c = cs[0];
        vec2 z0 = z0s[0];

        float scale = x_diff;

        // Addons (each line one):
        // z0.x += sin(distance2 * c.y);
        // z0.y += sin(phase);
        // c.x += (distance2 - 0.5) * 0.1;
        // c.y += x_center * 0.1;
        // z0.y += sin(phase+c.y*2);

        // z0.x = sin(c.x * 10 + phase);
        // z0.x = sin(phase) + sin(c.y * 10) * 5;

        // Static Buddha
        // vec4 e1 = vec4(1, 0, 0, 0) / 2;
        // vec4 e2 = vec4(0, 1, 0, 0) / 2;

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
mat4 m_zx = mat4(
    vec4(cos(theta_zx), 0, -sin(theta_zx), 0),
    vec4(0, 1, 0, 0),
    vec4(sin(theta_zx), 0, cos(theta_zx), 0),
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
    vec4(0, cos(theta_yw), 0, -sin(theta_yw)),
    vec4(0, 0, 1, 0),
    vec4(0, sin(theta_yw), 0, cos(theta_yw))
);
mat4 m_zw = mat4(
    vec4(1, 0, 0, 0),
    vec4(0, 1, 0, 0),
    vec4(0, 0, cos(theta_zw), -sin(theta_zw)),
    vec4(0, 0, sin(theta_zw), cos(theta_zw))
);

mat4 mat = m_xy * m_yz * m_zw * m_xw * m_yw * m_zw;

vec4 e1 = mat[0] / 2 * scale;
vec4 e2 = mat[1] / 2 * scale;

        vec4 cz = vec4(0, 0, 0, 0);
        cz.zw = c;

        vec2 z = z0;
        int t = 0;
        while(t < max_iteration) {
            z = vec2(z.x * z.x - z.y * z.y, z.x * z.y * 2.0) + c;
            if(z.x * z.x + z.y * z.y > 16) break;
            if(t > 0) {
                cz.xy = z;
                gl_Position = vec4(dot(cz, e1), dot(cz, e2), 0, 1);
                EmitVertex();
            }
            t += 1;
        }
    }
"""

fragment_shader = """
    #version 330
    layout(location = 0) out vec4 fragment_output;
    uniform float scaler;
    void main() {
        float v = scaler;
        fragment_output = vec4(v, v, v, 1);
    }
"""

composite_vertex_shader = """
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
"""

composite_fragment_shader = """
    #version 330
    uniform sampler2D texCounter;
    uniform sampler2D texColormap;
    uniform float max_counter;
    uniform float color_phase;
    in vec2 tex_coord;
    layout(location = 0) out vec4 fragment_output;
    void main() {
        vec4 counter = texture(texCounter, tex_coord);
        float v = counter.r / max_counter;
        float p = 1 - 1 / (1 + v);
        fragment_output = texture(texColormap, vec2(p, color_phase));
    }
"""

getShaderInfoLog = (shader) ->
    buffer = new Buffer(4)
    GL.getShaderiv(shader, GL.INFO_LOG_LENGTH, buffer)
    length = buffer.readUInt32LE(0)
    if length > 0
        buf = new Buffer(length)
        GL.getShaderInfoLog(shader, length, buffer, buf)
        buf.toString("utf-8")

getProgramInfoLog = (program) ->
    buffer = new Buffer(4)
    GL.getProgramiv(program, GL.INFO_LOG_LENGTH, buffer)
    length = buffer.readUInt32LE(0)
    if length > 0
        buf = new Buffer(length)
        GL.getProgramInfoLog(program, length, buffer, buf)
        buf.toString("utf-8")
    else
        null

compileShaders3 = (vertex_shader, geometry_shader, fragment_shader) ->
    shader_v = GL.createShader(GL.VERTEX_SHADER)
    GL.shaderSource(shader_v, [vertex_shader])
    if geometry_shader?
        shader_g = GL.createShader(GL.GEOMETRY_SHADER)
        GL.shaderSource(shader_g, [geometry_shader])
    shader_f = GL.createShader(GL.FRAGMENT_SHADER)
    GL.shaderSource(shader_f, [fragment_shader])
    program = GL.createProgram()

    GL.compileShader(shader_v)
    log = getShaderInfoLog(shader_v)
    if log?
        console.log(log)
    if geometry_shader?
        GL.compileShader(shader_g)
        log = getShaderInfoLog(shader_g)
        if log?
            console.log(log)
    GL.compileShader(shader_f)
    log = getShaderInfoLog(shader_f)
    if log?
        console.log(log)

    GL.attachShader(program, shader_v)
    if geometry_shader?
        GL.attachShader(program, shader_g)
    GL.attachShader(program, shader_f)

    GL.linkProgram(program)
    log = getProgramInfoLog(program)
    if log?
        console.log(log)

    program

setupBuffers = () ->
    @vertex_buffer = new GL.Buffer()
    @vertex_array = new GL.VertexArray()
    buffer = require("fs").readFileSync("data.bin")
    @vertices = buffer.length / 4 / 4
    vertices /= 2
    vertices /= 8

    console.log("Number of vertices:", vertices)

    GL.bindBuffer(GL.ARRAY_BUFFER, vertex_buffer)
    GL.bufferData(GL.ARRAY_BUFFER, buffer.length, buffer, GL.STATIC_DRAW)

    GL.bindVertexArray(vertex_array)
    GL.enableVertexAttribArray(0)
    GL.bindBuffer(GL.ARRAY_BUFFER, vertex_buffer)
    GL.vertexAttribPointer(0, 4, GL.FLOAT, GL.FALSE, 16, 0)
    GL.bindBuffer(GL.ARRAY_BUFFER, 0)
    GL.bindVertexArray(0)

    @framebuffer = new GL.Framebuffer()
    @framebuffer_texture = new GL.Texture()
    @framebuffer_size = 2048
    @point_size = 2

    GL.bindTexture(GL.TEXTURE_2D, framebuffer_texture)
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_LINEAR)
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR)
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE)
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE)
    GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA32F, framebuffer_size, framebuffer_size, 0, GL.RGBA, GL.FLOAT, 0)
    GL.bindTexture(GL.TEXTURE_2D, 0)

    GL.bindFramebuffer(GL.FRAMEBUFFER, framebuffer)
    GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, framebuffer_texture, 0)
    s = GL.checkFramebufferStatus(GL.FRAMEBUFFER)
    if s != GL.FRAMEBUFFER_COMPLETE
        console.log("Framebuffer incomplete:", s)
    GL.bindFramebuffer(GL.FRAMEBUFFER, 0)

    @quad_buffer = new GL.Buffer()
    @quad_array = new GL.VertexArray()

    buffer = new Buffer(4 * 8)
    buffer.writeFloatLE(0, 0 * 4)
    buffer.writeFloatLE(0, 1 * 4)
    buffer.writeFloatLE(0, 2 * 4)
    buffer.writeFloatLE(1, 3 * 4)
    buffer.writeFloatLE(1, 4 * 4)
    buffer.writeFloatLE(0, 5 * 4)
    buffer.writeFloatLE(1, 6 * 4)
    buffer.writeFloatLE(1, 7 * 4)

    GL.bindBuffer(GL.ARRAY_BUFFER, quad_buffer)
    GL.bufferData(GL.ARRAY_BUFFER, buffer.length, buffer, GL.STATIC_DRAW)

    GL.bindVertexArray(quad_array)
    GL.enableVertexAttribArray(0)
    GL.bindBuffer(GL.ARRAY_BUFFER, quad_buffer)
    GL.vertexAttribPointer(0, 2, GL.FLOAT, GL.FALSE, 8, 0)
    GL.bindBuffer(GL.ARRAY_BUFFER, 0)
    GL.bindVertexArray(0)

    @colormap_image = graphics.loadImageData(require("fs").readFileSync(__dirname + "/gradient_2d.png"));
    colormap_image.uploadTexture()


setupRender = () ->
    @program = compileShaders3(vertex_shader, geometry_shader, fragment_shader)
    @program_composite = compileShaders3(composite_vertex_shader, undefined, composite_fragment_shader)
    GL.useProgram(program_composite)
    GL.uniform1i(GL.getUniformLocation(program_composite, "texCounter"), 0)
    GL.uniform1i(GL.getUniformLocation(program_composite, "texColormap"), 1)
    GL.useProgram(0)
    setupBuffers()

t0 = new Date().getTime()

render_fractal = () ->
    time = (new Date().getTime() - t0) / 2000
    parameters['time'] = time

    GL.disable(GL.DEPTH_TEST)
    GL.depthMask(GL.FALSE)

    GL.bindFramebuffer(GL.FRAMEBUFFER, framebuffer)
    GL.viewport(0, 0, framebuffer_size, framebuffer_size)
    GL.clear(GL.COLOR_BUFFER_BIT)
    GL.enable(GL.BLEND);
    GL.blendFunc(GL.ONE, GL.ONE);
    GL.useProgram(program)

    for key of parameters
        GL.uniform1f(GL.getUniformLocation(program, key), parameters[key])

    GL.bindVertexArray(vertex_array)
    GL.pointSize(point_size);
    GL.uniform1f(GL.getUniformLocation(program, "scaler"), 1)
    GL.drawArrays(GL.POINTS, 0, vertices)
    # GL.pointSize(point_size * 8);
    # GL.uniform1f(GL.getUniformLocation(program, "scaler"), 1.0 / 0.004291541401937571 / 64)
    # GL.drawArrays(GL.POINTS, vertices / 2, vertices / 2 / 8)
    GL.bindVertexArray(0)
    GL.useProgram(0)
    GL.bindFramebuffer(GL.FRAMEBUFFER, 0)
    GL.bindTexture(GL.TEXTURE_2D, framebuffer_texture)
    GL.generateMipmap(GL.TEXTURE_2D)
    GL.bindTexture(GL.TEXTURE_2D, 0)

n = 0

render = () ->
    render_fractal()
    n = 1

    sz = w.getFramebufferSize()
    GL.clear(GL.COLOR_BUFFER_BIT)
    GL.viewport(0, 0, sz[0], sz[1])
    GL.useProgram(program_composite)

    pixel_size = 1024 * 1024 * (point_size * point_size) / (framebuffer_size * framebuffer_size)
    GL.uniform1f(GL.getUniformLocation(program_composite, "max_counter"), 70 * pixel_size * vertices / 1000000)
    if sz[0] < sz[1]
        y_scale = sz[0] / sz[1]
        x_scale = 1
    else
        x_scale = sz[1] / sz[0]
        y_scale = 1
    GL.uniform1f(GL.getUniformLocation(program_composite, "y_scale"), y_scale)
    GL.uniform1f(GL.getUniformLocation(program_composite, "x_scale"), x_scale)
    GL.uniform1f(GL.getUniformLocation(program_composite, "color_phase"), parameters["color_phase"])
    GL.disable(GL.BLEND)

    GL.bindVertexArray(quad_array)
    GL.activeTexture(GL.TEXTURE0)
    GL.bindTexture(GL.TEXTURE_2D, framebuffer_texture)
    colormap_image.bindTexture(1)
    GL.activeTexture(GL.TEXTURE1)
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    GL.drawArrays(GL.TRIANGLE_STRIP, 0, 4)
    colormap_image.unbindTexture(1)
    GL.activeTexture(GL.TEXTURE0)
    GL.bindTexture(GL.TEXTURE_2D, 0)
    GL.bindVertexArray(0)
    GL.useProgram(0)


    # GL.viewport(sz[0], sz[1], sz[0], sz[1])
    # GL.useProgram(program_composite)

    # pixel_size = 1024 * 1024 * (point_size * point_size) / (framebuffer_size * framebuffer_size)
    # GL.uniform1f(GL.getUniformLocation(program_composite, "max_counter"), 70 * pixel_size * vertices / 1000000)
    # if sz[0] < sz[1]
    #     y_scale = sz[0] / sz[1]
    #     x_scale = 1
    # else
    #     x_scale = sz[1] / sz[0]
    #     y_scale = 1
    # GL.uniform1f(GL.getUniformLocation(program_composite, "y_scale"), y_scale)
    # GL.uniform1f(GL.getUniformLocation(program_composite, "x_scale"), x_scale)
    # GL.disable(GL.BLEND)

    # GL.bindVertexArray(quad_array)
    # GL.activeTexture(GL.TEXTURE0)
    # GL.bindTexture(GL.TEXTURE_2D, framebuffer_texture)
    # colormap_image.bindTexture(1)
    # GL.activeTexture(GL.TEXTURE1)
    # GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    # GL.drawArrays(GL.TRIANGLE_STRIP, 0, 4)
    # colormap_image.unbindTexture(1)
    # GL.activeTexture(GL.TEXTURE0)
    # GL.bindTexture(GL.TEXTURE_2D, 0)
    # GL.bindVertexArray(0)
    # GL.useProgram(0)

    err = GL.getError()
    if err != 0
        console.log(err)

    w.swapBuffers()

setupRender()
render()
w.onRefresh(render)

fps_t_prev = new Date().getTime()
fps = 0

timer = setInterval (() ->
    render()
    t = new Date().getTime()
    dt = t - fps_t_prev
    fps_t_prev = t
    fps = 1000 / dt
    w.pollEvents()
    ), 1

setInterval (() ->
    console.log("FPS:", fps)
    ), 1000

w.onClose () ->
    clearInterval(timer)
