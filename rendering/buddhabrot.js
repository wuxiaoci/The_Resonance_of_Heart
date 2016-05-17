// Generated by CoffeeScript 1.10.0
(function() {
  var GL, allofw, compileShaders3, composite_fragment_shader, composite_vertex_shader, fps, fps_t_prev, fragment_shader, geometry_shader, getProgramInfoLog, getShaderInfoLog, graphics, msgpack, n, parameters, render, render_fractal, setupBuffers, setupRender, t0, timer, vertex_shader, w, zmq, zmq_sub;

  allofw = require("allofw");

  zmq = require("zmq");

  msgpack = require("msgpack");

  parameters = {
    "phase": 0,
    "distance1": 0,
    "distance2": 0,
    "distance3": 0,
    "distance4": 0
  };

  zmq_sub = zmq.socket("sub");

  zmq_sub.connect("tcp://192.168.1.109:60070");

  zmq_sub.subscribe("");

  zmq_sub.on("message", function(buffer) {
    var distance, rotation3, rotation4, state, subtract;
    state = msgpack.unpack(buffer);
    distance = function(a, b) {
      return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2]));
    };
    subtract = function(a, b) {
      return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    };
    parameters['distance1'] = distance(state.left.thumb_distal, state.left.index_distal) / 100;
    parameters['distance2'] = distance(state.right.thumb_distal, state.right.index_distal) / 100;
    rotation3 = Math.atan2(state.right.normal[1], -state.right.normal[0]);
    parameters['rotation3'] = rotation3;
    rotation4 = Math.atan2(state.right.normal[1], -state.right.normal[2]);
    return parameters['rotation4'] = rotation4;
  });

  GL = allofw.GL3;

  graphics = allofw.graphics;

  w = new allofw.OpenGLWindow({
    title: "Buddhabrot Renderer",
    width: 1024,
    height: 1024
  });

  w.makeContextCurrent();

  vertex_shader = "#version 330\nlayout(location = 0) in vec4 sample;\nout vec2 cs;\nout vec2 z0s;\nvoid main() {\n    cs = sample.xy;\n    z0s = sample.zw;\n}";

  geometry_shader = "#version 330\nlayout(points) in;\nlayout(points, max_vertices = 256) out;\n\nuniform float phase = 0;\nuniform float rotation1 = 0;\nuniform float rotation2 = 0;\nuniform float rotation3 = 0;\nuniform float rotation4 = 0;\nuniform float distance1 = 0;\nuniform float distance2 = 0;\n\nconst int max_iteration = 256;\n\nin vec2 cs[1];\nin vec2 z0s[1];\n\nvoid main() {\n    vec2 c = cs[0];\n    vec2 z0 = z0s[0];\n\n    // Addons (each line one):\n    z0.x += sin(distance2 * c.y);\n    // z0.y += sin(phase);\n    // c.x += (distance2 - 0.5) * 0.1;\n    c.y += (distance1 - 0.5) * 0.1;\n    // z0.y += sin(phase+c.y*2);\n\n    // z0.x = sin(c.x * 10 + phase);\n    // z0.x = sin(phase) + sin(c.y * 10) * 5;\n\n    // Static Buddha\n    // vec4 e1 = vec4(1, 0, 0, 0) / 2;\n    // vec4 e2 = vec4(0, 1, 0, 0) / 2;\n\n    // Rotation 1 (Horizontal)\n    mat4 m_23 = mat4(\n        vec4(1, 0, 0, 0),\n        vec4(0, cos(rotation3), -sin(rotation3), 0),\n        vec4(0, sin(rotation3),  cos(rotation3), 0),\n        vec4(0, 0, 0, 1)\n    );\n\n    mat4 m_14 = mat4(\n        vec4(cos(rotation4), 0, 0, -sin(rotation4)),\n        vec4(0, 1, 0, 0),\n        vec4(0, 0, 1, 0),\n        vec4(sin(rotation4), 0, 0, cos(rotation4))\n    );\n\n    mat4 m_combined = m_23 * m_14;\n\n    vec4 e1 = m_combined[0] / 2;\n    vec4 e2 = m_combined[1] / 2;\n\n    vec4 cz = vec4(0, 0, 0, 0);\n    cz.zw = c;\n\n    vec2 z = z0;\n    int t = 0;\n    while(t < max_iteration) {\n        z = vec2(z.x * z.x - z.y * z.y, z.x * z.y * 2.0) + c;\n        if(z.x * z.x + z.y * z.y > 16) break;\n        if(t > 0) {\n            cz.xy = z;\n            gl_Position = vec4(dot(cz, e1), dot(cz, e2), 0, 1);\n            EmitVertex();\n        }\n        t += 1;\n    }\n}";

  fragment_shader = "#version 330\nlayout(location = 0) out vec4 fragment_output;\nuniform float scaler;\nvoid main() {\n    float v = scaler;\n    fragment_output = vec4(v, v, v, 1);\n}";

  composite_vertex_shader = "#version 330\nuniform float x_scale;\nuniform float y_scale;\nlayout(location = 0) in vec2 pos;\nout vec2 tex_coord;\nvoid main() {\n    tex_coord = vec2(1.0 - pos.y, pos.x);\n    gl_Position = vec4(pos * 2.0 - 1.0, 0, 1);\n    gl_Position.x *= x_scale;\n    gl_Position.y *= y_scale;\n}";

  composite_fragment_shader = "#version 330\nuniform sampler2D texCounter;\nuniform sampler2D texColormap;\nuniform float max_counter;\nin vec2 tex_coord;\nlayout(location = 0) out vec4 fragment_output;\nvoid main() {\n    vec4 counter = texture(texCounter, tex_coord);\n    float v = counter.r / max_counter;\n    float p = 1 - 1 / (1 + v);\n    fragment_output = texture(texColormap, vec2(p, 0.5));\n}";

  getShaderInfoLog = function(shader) {
    var buf, buffer, length;
    buffer = new Buffer(4);
    GL.getShaderiv(shader, GL.INFO_LOG_LENGTH, buffer);
    length = buffer.readUInt32LE(0);
    if (length > 0) {
      buf = new Buffer(length);
      GL.getShaderInfoLog(shader, length, buffer, buf);
      return buf.toString("utf-8");
    }
  };

  getProgramInfoLog = function(program) {
    var buf, buffer, length;
    buffer = new Buffer(4);
    GL.getProgramiv(program, GL.INFO_LOG_LENGTH, buffer);
    length = buffer.readUInt32LE(0);
    if (length > 0) {
      buf = new Buffer(length);
      GL.getProgramInfoLog(program, length, buffer, buf);
      return buf.toString("utf-8");
    } else {
      return null;
    }
  };

  compileShaders3 = function(vertex_shader, geometry_shader, fragment_shader) {
    var log, program, shader_f, shader_g, shader_v;
    shader_v = GL.createShader(GL.VERTEX_SHADER);
    GL.shaderSource(shader_v, [vertex_shader]);
    if (geometry_shader != null) {
      shader_g = GL.createShader(GL.GEOMETRY_SHADER);
      GL.shaderSource(shader_g, [geometry_shader]);
    }
    shader_f = GL.createShader(GL.FRAGMENT_SHADER);
    GL.shaderSource(shader_f, [fragment_shader]);
    program = GL.createProgram();
    GL.compileShader(shader_v);
    log = getShaderInfoLog(shader_v);
    if (log != null) {
      console.log(log);
    }
    if (geometry_shader != null) {
      GL.compileShader(shader_g);
      log = getShaderInfoLog(shader_g);
      if (log != null) {
        console.log(log);
      }
    }
    GL.compileShader(shader_f);
    log = getShaderInfoLog(shader_f);
    if (log != null) {
      console.log(log);
    }
    GL.attachShader(program, shader_v);
    if (geometry_shader != null) {
      GL.attachShader(program, shader_g);
    }
    GL.attachShader(program, shader_f);
    GL.linkProgram(program);
    log = getProgramInfoLog(program);
    if (log != null) {
      console.log(log);
    }
    return program;
  };

  setupBuffers = function() {
    var buffer, s;
    this.vertex_buffer = new GL.Buffer();
    this.vertex_array = new GL.VertexArray();
    buffer = require("fs").readFileSync("data.bin");
    this.vertices = buffer.length / 4 / 4;
    vertices /= 2;
    vertices /= 32;
    console.log("Number of vertices:", vertices);
    GL.bindBuffer(GL.ARRAY_BUFFER, vertex_buffer);
    GL.bufferData(GL.ARRAY_BUFFER, buffer.length, buffer, GL.STATIC_DRAW);
    GL.bindVertexArray(vertex_array);
    GL.enableVertexAttribArray(0);
    GL.bindBuffer(GL.ARRAY_BUFFER, vertex_buffer);
    GL.vertexAttribPointer(0, 4, GL.FLOAT, GL.FALSE, 16, 0);
    GL.bindBuffer(GL.ARRAY_BUFFER, 0);
    GL.bindVertexArray(0);
    this.framebuffer = new GL.Framebuffer();
    this.framebuffer_texture = new GL.Texture();
    this.framebuffer_size = 2048;
    this.point_size = 2;
    GL.bindTexture(GL.TEXTURE_2D, framebuffer_texture);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_LINEAR);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
    GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA32F, framebuffer_size, framebuffer_size, 0, GL.RGBA, GL.FLOAT, 0);
    GL.bindTexture(GL.TEXTURE_2D, 0);
    GL.bindFramebuffer(GL.FRAMEBUFFER, framebuffer);
    GL.framebufferTexture2D(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, framebuffer_texture, 0);
    s = GL.checkFramebufferStatus(GL.FRAMEBUFFER);
    if (s !== GL.FRAMEBUFFER_COMPLETE) {
      console.log("Framebuffer incomplete:", s);
    }
    GL.bindFramebuffer(GL.FRAMEBUFFER, 0);
    this.quad_buffer = new GL.Buffer();
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
    GL.bindVertexArray(quad_array);
    GL.enableVertexAttribArray(0);
    GL.bindBuffer(GL.ARRAY_BUFFER, quad_buffer);
    GL.vertexAttribPointer(0, 2, GL.FLOAT, GL.FALSE, 8, 0);
    GL.bindBuffer(GL.ARRAY_BUFFER, 0);
    GL.bindVertexArray(0);
    this.colormap_image = graphics.loadImageData(require("fs").readFileSync(__dirname + "/gradient.png"));
    return colormap_image.uploadTexture();
  };

  setupRender = function() {
    this.program = compileShaders3(vertex_shader, geometry_shader, fragment_shader);
    this.program_composite = compileShaders3(composite_vertex_shader, void 0, composite_fragment_shader);
    GL.useProgram(program_composite);
    GL.uniform1i(GL.getUniformLocation(program_composite, "texCounter"), 0);
    GL.uniform1i(GL.getUniformLocation(program_composite, "texColormap"), 1);
    GL.useProgram(0);
    return setupBuffers();
  };

  t0 = new Date().getTime();

  render_fractal = function() {
    var phase;
    phase = (new Date().getTime() - t0) / 5000;
    GL.disable(GL.DEPTH_TEST);
    GL.depthMask(GL.FALSE);
    GL.bindFramebuffer(GL.FRAMEBUFFER, framebuffer);
    GL.viewport(0, 0, framebuffer_size, framebuffer_size);
    GL.clear(GL.COLOR_BUFFER_BIT);
    GL.enable(GL.BLEND);
    GL.blendFunc(GL.ONE, GL.ONE);
    GL.useProgram(program);
    GL.uniform1f(GL.getUniformLocation(program, "distance1"), parameters['distance1']);
    GL.uniform1f(GL.getUniformLocation(program, "distance2"), parameters['distance2']);
    GL.uniform1f(GL.getUniformLocation(program, "rotation1"), parameters['rotation1']);
    GL.uniform1f(GL.getUniformLocation(program, "rotation2"), parameters['rotation2']);
    GL.uniform1f(GL.getUniformLocation(program, "rotation3"), parameters['rotation3']);
    GL.uniform1f(GL.getUniformLocation(program, "rotation4"), parameters['rotation4']);
    GL.uniform1f(GL.getUniformLocation(program, "phase"), phase);
    GL.bindVertexArray(vertex_array);
    GL.pointSize(point_size);
    GL.uniform1f(GL.getUniformLocation(program, "scaler"), 1);
    GL.drawArrays(GL.POINTS, 0, vertices);
    GL.bindVertexArray(0);
    GL.useProgram(0);
    GL.bindFramebuffer(GL.FRAMEBUFFER, 0);
    GL.bindTexture(GL.TEXTURE_2D, framebuffer_texture);
    GL.generateMipmap(GL.TEXTURE_2D);
    return GL.bindTexture(GL.TEXTURE_2D, 0);
  };

  n = 0;

  render = function() {
    var err, pixel_size, sz, x_scale, y_scale;
    render_fractal();
    n = 1;
    sz = w.getFramebufferSize();
    GL.viewport(0, 0, sz[0], sz[1]);
    GL.useProgram(program_composite);
    pixel_size = 1024 * 1024 * (point_size * point_size) / (framebuffer_size * framebuffer_size);
    GL.uniform1f(GL.getUniformLocation(program_composite, "max_counter"), 2000 * pixel_size * vertices / 1000000);
    if (sz[0] < sz[1]) {
      y_scale = sz[0] / sz[1];
      x_scale = 1;
    } else {
      x_scale = sz[1] / sz[0];
      y_scale = 1;
    }
    GL.uniform1f(GL.getUniformLocation(program_composite, "y_scale"), y_scale);
    GL.uniform1f(GL.getUniformLocation(program_composite, "x_scale"), x_scale);
    GL.disable(GL.BLEND);
    GL.clear(GL.COLOR_BUFFER_BIT);
    GL.bindVertexArray(quad_array);
    GL.activeTexture(GL.TEXTURE0);
    GL.bindTexture(GL.TEXTURE_2D, framebuffer_texture);
    colormap_image.bindTexture(1);
    GL.activeTexture(GL.TEXTURE1);
    GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    GL.drawArrays(GL.TRIANGLE_STRIP, 0, 4);
    colormap_image.unbindTexture(1);
    GL.activeTexture(GL.TEXTURE0);
    GL.bindTexture(GL.TEXTURE_2D, 0);
    GL.bindVertexArray(0);
    GL.useProgram(0);
    err = GL.getError();
    if (err !== 0) {
      console.log(err);
    }
    return w.swapBuffers();
  };

  setupRender();

  render();

  w.onRefresh(render);

  fps_t_prev = new Date().getTime();

  fps = 0;

  timer = setInterval((function() {
    var dt, t;
    render();
    t = new Date().getTime();
    dt = t - fps_t_prev;
    fps_t_prev = t;
    fps = 1000 / dt;
    return w.pollEvents();
  }), 1);

  setInterval((function() {
    return console.log("FPS:", fps);
  }), 1000);

  w.onClose(function() {
    return clearInterval(timer);
  });

}).call(this);
