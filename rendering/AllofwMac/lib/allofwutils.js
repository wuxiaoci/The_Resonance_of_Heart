var allofw = require("allofw");
var allofwutils = exports;

(function() {

    var utils = { };
    allofwutils.utils = utils;

// Make an object capable for accepting events.
// Binding behaviour is similar to d3.
// on("event:namespace", handler)
// raise("event", arguments, this)
var makeEventSource = function (obj) {
    var handlers = {};
    obj.on = function (event, callback) {
        var e = event.split(".");
        if (!e[1]) e[1] = "";
        if (!handlers[e[0]]) handlers[e[0]] = {};
        handlers[e[0]][e[1]] = callback;
    };
    obj.raise = function (e) {
        if (!handlers[e]) return;
        for (var k in handlers[e]) {
            handlers[e][k].apply(null, Array.prototype.slice.call(arguments, 1));
        }
    };
};

utils.makeEventSource = makeEventSource;

(function() {

    var GL = allofw.GL3;

    var getShaderInfoLog = function(shader) {
        var buffer = new Buffer(4);
        GL.getShaderiv(shader, GL.INFO_LOG_LENGTH, buffer);
        var length = buffer.readUInt32LE(0);
        if(length > 0) {
            var buf = new Buffer(length);
            GL.getShaderInfoLog(shader, length, buffer, buf);
            return buf.toString("utf-8");
        }
    };

    var isShaderCompiled = function(shader) {
        var buffer = new Buffer(4);
        GL.getShaderiv(shader, GL.COMPILE_STATUS, buffer);
        var success = buffer.readUInt32LE(0);
        return success != 0;
    };
    var isProgramLinked = function(program) {
        var buffer = new Buffer(4);
        GL.getProgramiv(program, GL.LINK_STATUS, buffer);
        var success = buffer.readUInt32LE(0);
        return success != 0;
    };

    var getProgramInfoLog = function(program) {
        var buffer = new Buffer(4);
        GL.getProgramiv(program, GL.INFO_LOG_LENGTH, buffer);
        var length = buffer.readUInt32LE(0);
        if(length > 0) {
            var buf = new Buffer(length);
            GL.getProgramInfoLog(program, length, buffer, buf);
            return buf.toString("utf-8");
        }
    };

    function ShaderException(type, message) {
       this.message = "CompileShaders: " + type + ": " + message;
       this.name = "ShaderException";
    }

    var compileShaders = function(shaders) {
        var shader_v, shader_f, shader_g;
        if(shaders.vertex) {
            shader_v = GL.createShader(GL.VERTEX_SHADER);
            GL.shaderSource(shader_v, [shaders.vertex]);
            GL.compileShader(shader_v);
            var log = getShaderInfoLog(shader_v);
            if(log && log.trim() != "") {
                console.log(log);
            }
            if(!isShaderCompiled(shader_v)) {
                throw new ShaderException("Vertex");
            }
        }
        if(shaders.fragment) {
            shader_f = GL.createShader(GL.FRAGMENT_SHADER);
            GL.shaderSource(shader_f, [shaders.fragment]);
            GL.compileShader(shader_f);
            var log = getShaderInfoLog(shader_f);
            if(log && log.trim() != "") {
                console.log(log);
            }
            if(!isShaderCompiled(shader_f)) {
                throw new ShaderException("Fragment");
            }
        }
        if(shaders.geometry) {
            shader_g = GL.createShader(GL.GEOMETRY_SHADER);
            GL.shaderSource(shader_g, [shaders.geometry]);
            GL.compileShader(shader_g);
            if(log && log.trim() != "") {
                console.log(log);
            }
            if(!isShaderCompiled(shader_g)) {
                throw new ShaderException("Geometry");
            }
        }

        var program = GL.createProgram();

        if(shader_v) GL.attachShader(program, shader_v);
        if(shader_f) GL.attachShader(program, shader_f);
        if(shader_g) GL.attachShader(program, shader_g);

        GL.linkProgram(program);
        var log = getProgramInfoLog(program);
        if(log && log.trim() != "") {
            console.log(log);
        }
        if(!isProgramLinked(program)) {
            throw new ShaderException("Link");
        }
        return program;
    };

    utils.compileShaders = compileShaders;

    utils.checkGLError = function(prefix) {
        var err = GL.getError();
        if(err != 0) {
            if(prefix) {
                allofw.log(allofw.kInfo, "OpenGL Error #" + err + " at " + prefix);
            } else {
                allofw.log(allofw.kInfo, "OpenGL Error #" + err);
            }
        }
    };

})();

// Parse config file.

function overrideObject(dest, src) {
    for(var key in src) {
        if(!src.hasOwnProperty(key)) continue;
        if(!dest[key]) {
            dest[key] = src[key];
        } else {
            if(typeof(dest[key]) == "object") {
                overrideObject(dest[key], src[key]);
            } else {
                dest[key] = src[key];
            }
        }
    }
};

function loadConfigFile(path, hostname) {
    var config = require("js-yaml").safeLoad(require("fs").readFileSync(path, 'utf8'));
    if(!hostname) hostname = require("os").hostname();
    if(config[hostname]) {
        overrideObject(config, config[hostname]);
    }
    return config;
};

utils.loadConfigFile = loadConfigFile;


})();

(function() {

var math = { };
allofwutils.math = math;

math.Vector3 = function(x, y, z) {
    this.x = x === undefined ? 0 : x;
    this.y = y === undefined ? 0 : y;
    this.z = z === undefined ? 0 : z;
};
math.Vector3.prototype = {
    clone: function() {
        return new math.Vector3(this.x, this.y, this.z);
    },
    add: function(v) {
        return new math.Vector3(v.x + this.x, v.y + this.y, v.z + this.z);
    },
    sub: function(v) {
        return new math.Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
    },
    dot: function(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    },
    scale: function(s) {
        return new math.Vector3(this.x * s, this.y * s, this.z * s);
    },
    cross: function(v) {
        return new math.Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    },
    length: function() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); },
    normalize: function() {
        var l = this.length();
        return new math.Vector3(this.x / l, this.y / l, this.z / l);
    },
    distance2: function(p) {
        return (this.x - p.x) * (this.x - p.x) + (this.y - p.y) * (this.y - p.y) + (this.z - p.z) * (this.z - p.z);
    },
    distance: function(p) {
        return Math.sqrt(this.distance2(p));
    },
    interp: function(v, t) {
        return new math.Vector3(this.x + (v.x - this.x) * t,
                              this.y + (v.y - this.y) * t,
                              this.z + (v.z - this.z) * t);
    },
    serialize: function() {
        return { de: "Vector3", x: this.x, y: this.y, z: this.z };
    }
};

math.Quaternion = function(v, w) {
    this.v = v !== undefined ? v : new math.Vector3(0, 0, 0);
    this.w = w === undefined ? 0 : w;
};
math.Quaternion.prototype.conj = function() {
    return new math.Quaternion(this.v.scale(-1), this.w);
};
math.Quaternion.prototype.mul = function(q2) {
    var w = this.w * q2.w - this.v.dot(q2.v);
    var v = q2.v.scale(this.w).add(this.v.scale(q2.w)).add(this.v.cross(q2.v));
    return new math.Quaternion(v, w);
};
math.Quaternion.prototype.rotate = function(vector) {
    var vq = new math.Quaternion(vector, 0);
    return this.mul(vq).mul(this.conj()).v;
};
math.Quaternion.rotation = function(axis, angle) {
    return new math.Quaternion(axis.normalize().scale(Math.sin(angle / 2)), Math.cos(angle / 2));
};
math.Quaternion.prototype.normalize = function() {
    var s = 1.0 / Math.sqrt(this.v.x * this.v.x + this.v.y * this.v.y + this.v.z * this.v.z + this.w * this.w);
    return new math.Quaternion(this.v.scale(s), this.w * s);
};
math.Quaternion.slerp = function(q1, q2, t) {
    var acos_arg = q1.v.x * q2.v.x + q1.v.y * q2.v.y + q1.v.z * q2.v.z + q1.w * q2.w;
    if(acos_arg > 1) acos_arg = 1;
    if(acos_arg < -1) acos_arg = -1;
    var omega = Math.acos(acos_arg);
    var st0, st1;
    if(Math.abs(omega) < 1e-10) {
        st0 = 1 - t;
        st1 = t;
    } else {
        var som = Math.sin(omega);
        st0 = Math.sin((1 - t) * omega) / som;
        st1 = Math.sin(t * omega) / som;
    }
    return new math.Quaternion(
        new math.Vector3(
            q1.v.x * st0 + q2.v.x * st1,
            q1.v.y * st0 + q2.v.y * st1,
            q1.v.z * st0 + q2.v.z * st1
        ),
        q1.w * st0 + q2.w * st1
    );
};
math.Quaternion.prototype.slerp = function(q2, t) {
    return math.Quaternion.slerp(this, q2, t);
};


})();

(function() {

function FPSCounter() {
    this.t_previous_frame = new Date().getTime();
    this.last_print = 0;
    this.fps_measures = [];
}
FPSCounter.prototype.update = function() {
    var t = new Date().getTime();
    var fps = 1000.0 / (t - this.t_previous_frame);
    this.fps_measures.push(fps);
    if(this.fps_measures.length > 100) {
        this.fps_measures.splice(0, 1);
    }
    if(t - this.last_print > 5000 && this.fps_measures.length > 0) {
        var fps_average = this.fps_measures.reduce(function(a, b) { return a + b; }) / this.fps_measures.length;
        console.log("FPS: " + fps_average);
        this.last_print = t;
    }
    this.t_previous_frame = t;
};

allofwutils.FPSCounter = FPSCounter;

var math = allofwutils.math;

allofwutils.WindowNavigation = function(window, omnistereo) {
    var self = this;

    var pose = {
        position: new math.Vector3(0, 0, 0),
        rotation: new math.Quaternion(new math.Vector3(0, 0, 0), 1)
    };
    this.pose = pose;
    var velocity = [ 0, 0, 0, 0, 0 ];
    var keys = {
        "W"      : [ 0,  0,  0, -1,  0,  0 ],
        "X"      : [ 0,  0,  0, +1,  0,  0 ],
        "A"      : [ 0, -1,  0,  0,  0,  0 ],
        "D"      : [ 0, +1,  0,  0,  0,  0 ],
        "Q"      : [ 0,  0, +1,  0,  0,  0 ],
        "Z"      : [ 0,  0, -1,  0,  0,  0 ],
        "UP"     : [ 0,  0,  0,  0,  0, +1 ],
        "DOWN"   : [ 0,  0,  0,  0,  0, -1 ],
        "LEFT"   : [ 0,  0,  0,  0, +1,  0 ],
        "RIGHT"  : [ 0,  0,  0,  0, -1,  0 ]
    };
    var velocity_prev = [ 0, 0, 0, 0, 0 ];

    var pose_target = null;

    var update = function(dt) {
        var vs = [ 0, 0, 0, 0, 0 ];
        for(var key in keys) {
            for(var i = 0; i < 5; i++) {
                vs[i] += keys[key][i + 1] * keys[key][0];
            }
        }
        var blend = Math.pow(1 - 0.5, dt * 10);
        for(var i = 0; i < 5; i++) {
            vs[i] = velocity_prev[i] * blend + vs[i] * (1 - blend);
            velocity_prev[i] = vs[i];
        }
        var speed = 5;
        pose.position = pose.position.add(pose.rotation.rotate(new math.Vector3(vs[0], vs[1], vs[2])).scale(speed * dt))
        pose.rotation = math.Quaternion.rotation(new math.Vector3(0, 1, 0), vs[3] * dt).mul(pose.rotation)
        pose.rotation = pose.rotation.mul(math.Quaternion.rotation(new math.Vector3(1, 0, 0), vs[4] * dt))

        if(pose_target) {
            pose.position = pose.position.interp(pose_target.position, 1 - blend);
            pose.rotation = pose.rotation.slerp(pose_target.rotation, 1 - blend);
        }

        omnistereo.setPose(pose.position.x, pose.position.y, pose.position.z,
                           pose.rotation.v.x, pose.rotation.v.y, pose.rotation.v.z, pose.rotation.w);
    };

    var t0 = new Date().getTime() / 1000;
    this.update = function() {
        var t = new Date().getTime() / 1000;
        update(t - t0);
        t0 = t;
    };

    window.onKeyboard(function(key, action, modifiers, scancode) {
        if(key == "O") {
            pose_target = {
                position: new math.Vector3(0, 0, 0),
                rotation: new math.Quaternion(new math.Vector3(0, 0, 0), 1)
            };
            velocity_prev = [ 0, 0, 0, 0, 0 ];
        }
        if(action == "PRESS") {
            pose_target = null;
            if(keys[key]) {
                keys[key][0] = 1;
            }
        }
        if(action == "RELEASE") {
            if(keys[key]) {
                keys[key][0] = 0;
            }
        }
        if(action == "PRESS" && key == "ESCAPE") {
            window.close();
        }
        self.raise("keyboard", key, action, modifiers, scancode);
    });

    allofwutils.utils.makeEventSource(this);

};

allofwutils.NetworkNavigation = function(networking) {
    var self = this;

    var pose = {
        position: new math.Vector3(0, 0, 0),
        rotation: new math.Quaternion(new math.Vector3(0, 0, 0), 1)
    };

    this.pose = pose;
    var velocity = [ 0, 0, 0, 0, 0 ];
    var keys = {
        "W"      : [ 0,  0,  0, -1,  0,  0 ],
        "X"      : [ 0,  0,  0, +1,  0,  0 ],
        "A"      : [ 0, -1,  0,  0,  0,  0 ],
        "D"      : [ 0, +1,  0,  0,  0,  0 ],
        "Q"      : [ 0,  0, +1,  0,  0,  0 ],
        "Z"      : [ 0,  0, -1,  0,  0,  0 ],
        "UP"     : [ 0,  0,  0,  0,  0, +1 ],
        "DOWN"   : [ 0,  0,  0,  0,  0, -1 ],
        "LEFT"   : [ 0,  0,  0,  0, +1,  0 ],
        "RIGHT"  : [ 0,  0,  0,  0, -1,  0 ]
    };
    var velocity_prev = [ 0, 0, 0, 0, 0 ];

    var pose_target = null;

    var update = function(dt) {
        var vs = [ 0, 0, 0, 0, 0 ];
        for(var key in keys) {
            for(var i = 0; i < 5; i++) {
                vs[i] += keys[key][i + 1] * keys[key][0];
            }
        }
        var blend = Math.pow(1 - 0.5, dt * 10);
        for(var i = 0; i < 5; i++) {
            vs[i] = velocity_prev[i] * blend + vs[i] * (1 - blend);
            velocity_prev[i] = vs[i];
        }
        var speed = 5;
        pose.position = pose.position.add(pose.rotation.rotate(new math.Vector3(vs[0], vs[1], vs[2])).scale(speed * dt))
        pose.rotation = math.Quaternion.rotation(new math.Vector3(0, 1, 0), vs[3] * dt).mul(pose.rotation)
        pose.rotation = pose.rotation.mul(math.Quaternion.rotation(new math.Vector3(1, 0, 0), vs[4] * dt))

        if(pose_target) {
            pose.position = pose.position.interp(pose_target.position, 1 - blend);
            pose.rotation = pose.rotation.slerp(pose_target.rotation, 1 - blend);
        }

        self.raise("pose",
            pose.position.x, pose.position.y, pose.position.z,
            pose.rotation.v.x, pose.rotation.v.y, pose.rotation.v.z, pose.rotation.w
        );
    };

    var home_position = new math.Vector3(0, 0, 0);
    var home_rotation = new math.Quaternion(new math.Vector3(0, 0, 0), 1);

    this.setPosition = function(position) {
        pose.position = position;
    };
    this.setRotation = function(rotation) {
        pose.rotation = rotation;
    };

    this.setHomePosition = function(position) {
        home_position = position;
    };
    this.setHomeRotation = function(rotation) {
        home_rotation = rotation;
    };

    var t0 = new Date().getTime() / 1000;
    this.update = function() {
        var t = new Date().getTime() / 1000;
        update(t - t0);
        t0 = t;
    };

    networking.on("nav", function(l_x, l_y, l_z, r_x, r_y) {
        if(l_x == "reset") {
            pose_target = {
                position: home_position,
                rotation: home_rotation
            };
            velocity_prev = [ 0, 0, 0, 0, 0 ];
        } else {
            pose_target = null;
            keys["D"][0] = l_x > 0 ? 0 : l_x;
            keys["A"][0] = l_x < 0 ? 0 : -l_x;
            keys["Z"][0] = l_y > 0 ? 0 : l_y;
            keys["Q"][0] = l_y < 0 ? 0 : -l_y;
            keys["X"][0] = l_z > 0 ? 0 : l_z;
            keys["W"][0] = l_z < 0 ? 0 : -l_z;

            keys["DOWN"][0] = r_y > 0 ? 0 : r_y;
            keys["UP"][0] = r_y < 0 ? 0 : -r_y;
            keys["RIGHT"][0] = r_x > 0 ? 0 : r_x;
            keys["LEFT"][0] = r_x < 0 ? 0 : -r_x;
        }
    });

    allofwutils.utils.makeEventSource(this);
};


})();

(function() {

var text = { };
allofwutils.text = text;

// Text rendering engine.
var graphics = require("allofw").graphics;

// Create a text cache of given width and height.
var TextCache = function(width, height) {
    if(width === undefined) width = 1024;
    if(height === undefined) height = 1024;
    this.entries = { };
    this.current_x = 0;
    this.current_y = 0;
    this.current_height = 0;
    this.width = width;
    this.height = height;
    this.surface = new graphics.Surface2D(width, height, graphics.SURFACETYPE_RASTER);
    this.context = new graphics.GraphicalContext2D(this.surface);
    this.context.clear(0, 0, 0, 0);
    this.paint = this.context.paint();
    this.paint.setLineJoin(graphics.LINEJOIN_ROUND);
};

var Font = function(font) {
    if(!font) font = { };
    this.family = font.family !== undefined ? font.family : "Arial";
    this.style = font.style !== undefined ? font.style : "normal";
    this.size = font.size !== undefined ? font.size : 12;
};

Font.prototype.hash = function() {
    return "F" + this.family + "," + this.size;
};

var Style = function(style) {
    if(!style) style = { };
    this.fill = style.fill;
    this.stroke = style.stroke;
    this.stroke_width = style.stroke_width !== undefined ? style.stroke_width : 1;
    this.order = style.order !== undefined ? style.order : "fill,stroke";
};

Style.prototype.hash = function() {
    return "S" +
           (this.fill ? this.fill.join(",") : "null") + "," +
           (this.stroke ? this.stroke.join(",") : "null") +
           this.stroke_width +
           this.order;
};

var string2fontstyle = {
    "normal": graphics.FONTSTYLE_NORMAL,
    "bold": graphics.FONTSTYLE_BOLD,
    "italic": graphics.FONTSTYLE_ITALIC,
    "bolditalic": graphics.FONTSTYLE_BOLDITALIC
};

// Add text of a given font to the cache.
TextCache.prototype.addText = function(text, font, style) {
    font = new Font(font);
    style = new Style(style);
    var hash = JSON.stringify(text) + font.hash() + style.hash();
    if(this.entries[hash]) {
        return this._layout2TextRect(this.entries[hash]);
    }
    this.paint.setTextSize(font.size);
    this.paint.setTypeface(font.family, string2fontstyle[font.style]);
    var width = this.paint.measureText(text);
    var height = font.size;
    var bbox_width = Math.ceil(width + 4 + style.stroke_width);
    var bbox_height = Math.ceil(height + 2 + style.stroke_width);
    var x_offset = 2 + style.stroke_width / 2;
    var baseline_offset = height - 2 + style.stroke_width / 2;

    if(bbox_width > this.width) {
        throw "E_FIT";
    }
    // If can't fit in current line, start a new line.
    if(this.current_x + bbox_width > this.width) {
        if(this.current_y + this.current_height + bbox_height > this.height) {
            throw "E_FIT";
        }
        this.current_x = 0;
        this.current_y += this.current_height;
        this.current_height = bbox_height;
    }
    // Here it must fit.

    var layout = {
        x: this.current_x, y: this.current_y,
        x_offset: x_offset,
        baseline_offset: baseline_offset,
        bbox_width: bbox_width,
        bbox_height: bbox_height
    };

    this.current_x += bbox_width;
    this.current_height = Math.max(this.current_height, bbox_height);

    this.entries[hash] = layout;
    // Render.
    var draw_x = layout.x + x_offset;
    var draw_y = layout.y + baseline_offset;
    if(style.order == "fill,stroke") {
        if(style.fill) {
            this.paint.setColor(style.fill[0], style.fill[1], style.fill[2], style.fill[3]);
            this.paint.setMode(graphics.PAINTMODE_FILL);
            this.context.drawText(text, draw_x, draw_y, this.paint);
        }
        if(style.stroke) {
            this.paint.setColor(style.stroke[0], style.stroke[1], style.stroke[2], style.stroke[3]);
            this.paint.setStrokeWidth(style.stroke_width);
            this.paint.setMode(graphics.PAINTMODE_STROKE);
            this.context.drawText(text, draw_x, draw_y, this.paint);
        }
    } else {
        if(style.stroke) {
            this.paint.setColor(style.stroke[0], style.stroke[1], style.stroke[2], style.stroke[3]);
            this.paint.setStrokeWidth(style.stroke_width);
            this.paint.setMode(graphics.PAINTMODE_STROKE);
            this.context.drawText(text, draw_x, draw_y, this.paint);
        }
        if(style.fill) {
            this.paint.setColor(style.fill[0], style.fill[1], style.fill[2], style.fill[3]);
            this.paint.setMode(graphics.PAINTMODE_FILL);
            this.context.drawText(text, draw_x, draw_y, this.paint);
        }
    }
    this.updated = true;
    // this.paint.setColor(0, 0, 0, 1);
    // this.paint.setStrokeWidth(1);
    // this.paint.setMode(graphics.PAINTMODE_STROKE);
    // this.context.drawRectangle(layout.x + 0.5, layout.y + 0.5, layout.bbox_width - 1, layout.bbox_height - 1, this.paint);

    return this._layout2TextRect(layout);
};
TextCache.prototype._layout2TextRect = function(layout) {
    return {
        x: layout.x, y: layout.y,
        w: layout.bbox_width, h: layout.bbox_height,
        x_offset: layout.x_offset,
        baseline_offset: layout.baseline_offset
    };
};
// Query the cache for a text and given font.
TextCache.prototype.getTextRect = function(text, font, style) {
    font = new Font(font);
    style = new Style(style);
    var hash = JSON.stringify(text) + font.hash() + style.hash();
    var layout = this.entries[hash];
    if(!layout) return null;
    return this._layout2TextRect(layout);
};

// Clear the cache.
TextCache.prototype.clear = function() {
    this.entries = { };
    this.current_x = 0;
    this.current_y = 0;
    this.current_height = 0;
    this.context.clear(0, 0, 0, 0);
};


text.TextCache = TextCache;


})();

// How to use:

(function() {

    var shape3d = { };
    allofwutils.shape3d = shape3d;

var GL = require("allofw").GL3;

var AttributeValue = function(type, repr) {
    this.type = type;
    this.repr = repr;
};

var VariableValue = function(type, repr) {
    this.type = type;
    if(typeof(repr) == "function") this.f = repr;
    else this.v = repr;
    this.layout_index = -1;
    this.byte_offset = 0;
};

VariableValue.prototype.update = function(repr) {
    if(typeof(repr) == "function") this.f = repr;
    else this.v = repr;
};

VariableValue.prototype.get = function(d) {
    return this.v !== undefined ? this.v : this.f(d);
};

VariableValue.prototype.writeBuffer = function(buf, offset, d) {
    offset += this.byte_offset;
    var val = this.get(d);
    if(this.type == "int") buf.writeInt32LE(val, offset);
    if(this.type == "float") buf.writeFloatLE(val, offset);
    if(this.type == "vec2") {
        buf.writeFloatLE(val[0], offset);
        buf.writeFloatLE(val[1], offset + 4);
    }
    if(this.type == "vec3") {
        buf.writeFloatLE(val[0], offset);
        buf.writeFloatLE(val[1], offset + 4);
        buf.writeFloatLE(val[2], offset + 8);
    }
    if(this.type == "vec4") {
        buf.writeFloatLE(val[0], offset);
        buf.writeFloatLE(val[1], offset + 4);
        buf.writeFloatLE(val[2], offset + 8);
        buf.writeFloatLE(val[3], offset + 12);
    }
};

VariableValue.prototype.setUniform = function(name, program) {
    var val = this.get(undefined);
    if(this.type == "int")
        GL.uniform1i(GL.getUniformLocation(program, name), val);
    if(this.type == "float")
        GL.uniform1f(GL.getUniformLocation(program, name), val);
    if(this.type == "vec2")
        GL.uniform2f(GL.getUniformLocation(program, name), val[0], val[1]);
    if(this.type == "vec3")
        GL.uniform3f(GL.getUniformLocation(program, name), val[0], val[1], val[2]);
    if(this.type == "vec4")
        GL.uniform4f(GL.getUniformLocation(program, name), val[0], val[1], val[2], val[3]);
};

VariableValue.prototype.getByteLength = function() {
    return {
        "char": 1,
        "int": 4,
        "float" : 4,
        "vec2": 8, "vec3": 12, "vec4": 16,
        "mat3": 36, "mat4": 64
    }[this.type];
};

var ShapeObject = function() {
    this.vars = { };
    this.vars_order = [];
    this.attrs = { };
    this.attrs_order = [];
    this.uniforms = { };
    this.vertex_array = new GL.VertexArray();
    this.vertex_buffer = new GL.Buffer();
};

ShapeObject.prototype.attr = function(type, name, value) {
    if(!this.attrs[name]) this.attrs_order.push(name);
    this.attrs[name] = new AttributeValue(type, value);
    return this;
};

ShapeObject.prototype.attrorder = function(names) {
    this.attrs_order = names;
    return this;
};

ShapeObject.prototype.variable = function(type, name, value) {
    if(this.vars[name]) {
        this.vars[name].update(value);
    } else {
        this.vars_order.push(name);
        this.vars[name] = new VariableValue(type, value);
    }
    return this;
};

ShapeObject.prototype.uniform = function(type, name, value) {
    if(this.uniforms[name]) this.uniforms[name].update(value);
    else this.uniforms[name] = new VariableValue(type, value);
    return this;
};

function getShaderInfoLog(shader) {
    var buffer = new Buffer(4);
    GL.getShaderiv(shader, GL.INFO_LOG_LENGTH, buffer);
    var length = buffer.readUInt32LE(0);
    if(length > 0) {
        var buf = new Buffer(length);
        GL.getShaderInfoLog(shader, length, buffer, buf);
        return buf.toString("utf-8");
    }
}

function getProgramInfoLog(program) {
    var buffer = new Buffer(4);
    GL.getProgramiv(program, GL.INFO_LOG_LENGTH, buffer);
    var length = buffer.readUInt32LE(0);
    if(length > 0) {
        var buf = new Buffer(length);
        GL.getProgramInfoLog(program, length, buffer, buf);
        return buf.toString("utf-8");
    }
}

ShapeObject.prototype.compile = function(omni) {
    var self = this;
    // Assign a name for each uniform.
    var uniform_defs = [];
    var input_defs = [];
    for(var name in this.uniforms) {
        var uniform = this.uniforms[name];
        uniform_defs.push("uniform " + uniform.type + " " + name + ";")
    }

    var layout_index = 0;
    var byte_offset = 0;
    for(var i = 0; i < this.vars_order.length; i++) {
        var name = this.vars_order[i];
        var variable = this.vars[name];
        variable.layout_index = layout_index;
        variable.byte_offset = byte_offset;
        // Define variable with its layout location.
        input_defs.push("layout(location = " + variable.layout_index + ") in "
                       + variable.type + " " + name + ";");
        layout_index += 1;
        byte_offset += variable.getByteLength();
    }
    this.vertex_byte_size = byte_offset;

    var attribute_lines = [];
    attribute_lines.push("void computeAttributes() {");
    var attr_names = [];
    for(var name in this.attrs) attr_names.push(name);
    attr_names.sort(function(a, b) {
        if(self.attrs_order) {
            var ia = self.attrs_order.indexOf(a);
            var ib = self.attrs_order.indexOf(b);
            return ia - ib;
        } else {
            return a < b ? -1 : (a == b ? 0 : 1);
        }
    });
    for(var i = 0; i < attr_names.length; i++) {
        var name = attr_names[i];
        var attr = this.attrs[name];
        attribute_lines.push("    " + name + " = " + attr.repr + ";");
    }
    attribute_lines.push("}");

    var shader_prefix = []
        .concat(uniform_defs)
        .concat(input_defs)
        .concat([""])
        .join("\n");

    var shader_v = null, shader_g = null, shader_f = null;

    var vertex_code =
        "#version 330\n" +
        shader_prefix +
        omni.getShaderCode() +
        this._vertexShader().replace("__ATTRIBUTE_LINES__", attribute_lines.join("\n"));

    shader_v = GL.createShader(GL.VERTEX_SHADER);
    GL.shaderSource(shader_v, [vertex_code]);

    if(this._geometryShader) {
        var geometry_code =
            "#version 330\n" +
            omni.getShaderCode() +
            this._geometryShader();

        shader_g = GL.createShader(GL.GEOMETRY_SHADER);
        GL.shaderSource(shader_g, [geometry_code]);
    }

    var fragment_code =
        "#version 330\n" +
        omni.getShaderCode() +
        uniform_defs.join("\n") +
        this._fragmentShader();

    shader_f = GL.createShader(GL.FRAGMENT_SHADER);
    GL.shaderSource(shader_f, [fragment_code]);

    this.program = GL.createProgram();
    GL.compileShader(shader_v);
    var log = getShaderInfoLog(shader_v);
    if(log) console.log(vertex_code + "\n" + log);
    if(shader_g) {
        GL.compileShader(shader_g);
        var log = getShaderInfoLog(shader_g);
        if(log) console.log(geometry_code + "\n" + log)
    }
    GL.compileShader(shader_f);
    var log = getShaderInfoLog(shader_f);
    if(log) console.log(fragment_code + "\n" + log);

    GL.attachShader(this.program, shader_v);
    GL.attachShader(this.program, shader_g);
    GL.attachShader(this.program, shader_f);

    GL.linkProgram(this.program);
    var log = getProgramInfoLog(this.program);
    if(log) console.log(log);

    GL.bindBuffer(GL.ARRAY_BUFFER, this.vertex_buffer);
    GL.bindVertexArray(this.vertex_array);
    for(var name in this.vars) {
        var variable = this.vars[name];
        GL.enableVertexAttribArray(variable.layout_index);
        if(variable.type == "float") {
            GL.vertexAttribPointer(variable.layout_index, 1, GL.FLOAT, GL.FALSE, this.vertex_byte_size, variable.byte_offset);
        }
        if(variable.type == "vec2") {
            GL.vertexAttribPointer(variable.layout_index, 2, GL.FLOAT, GL.FALSE, this.vertex_byte_size, variable.byte_offset);
        }
        if(variable.type == "vec3") {
            GL.vertexAttribPointer(variable.layout_index, 3, GL.FLOAT, GL.FALSE, this.vertex_byte_size, variable.byte_offset);
        }
        if(variable.type == "vec4") {
            GL.vertexAttribPointer(variable.layout_index, 4, GL.FLOAT, GL.FALSE, this.vertex_byte_size, variable.byte_offset);
        }
    }
    GL.bindBuffer(GL.ARRAY_BUFFER, 0);
    GL.bindVertexArray(0);

    GL.useProgram(this.program);
    for(var name in this.uniforms) {
        this.uniforms[name].setUniform(name, this.program.id());
    }
    GL.useProgram(0);

    return this;
};
ShapeObject.prototype.data = function(data) {
    if(!data) data = [ undefined ];
    this.vertex_count = data.length;

    GL.bindBuffer(GL.ARRAY_BUFFER, this.vertex_buffer);

    var buf = new Buffer(this.vertex_byte_size * data.length);

    for(var i = 0; i < data.length; i++) {
        offset = i * this.vertex_byte_size;
        for(var name in this.vars) {
            var variable = this.vars[name];
            variable.writeBuffer(buf, offset, data[i]);
        }
    }

    GL.bufferData(GL.ARRAY_BUFFER, buf.length, buf, GL.STATIC_DRAW)
    GL.bindBuffer(GL.ARRAY_BUFFER, 0);

    GL.useProgram(this.program.id());
    return this;
};

ShapeObject.prototype.render = function(omni) {
    GL.useProgram(this.program.id());

    for(var name in this.uniforms) {
        this.uniforms[name].setUniform(name, this.program.id());
    }
    omni.setUniforms(this.program.id());

    GL.bindVertexArray(this.vertex_array);
    GL.drawArrays(GL.POINTS, 0, this.vertex_count);

    GL.useProgram(0);

    var err = GL.getError();
    return this;
};

shape3d.ShapeObject = ShapeObject;
shape3d.VariableValue = VariableValue;

var SphereObject = function() {
    ShapeObject.call(this);
};

SphereObject.prototype = Object.create(ShapeObject.prototype);
SphereObject.prototype._vertexShader = function() { return `
    vec3 center;
    float radius;
    out vec4 _colors;
    out float _radiuses;
    out vec3 _positions;
    __ATTRIBUTE_LINES__
    void main() {
        computeAttributes();
        _colors = vec4(1, 1, 1, 1);
        _positions = omni_transform(center);
        _radiuses = radius;
    }
`; };

SphereObject.prototype._geometryShader = function() { return `
    layout(points) in;
    layout(triangle_strip, max_vertices = 50) out;
    in vec4 _colors[1];
    in float _radiuses[1];
    in vec3 _positions[1];

    out vec4 color;
    out float radius;
    out vec3 center;
    out vec3 p_prime;

    void main() {
        color = _colors[0];
        radius = _radiuses[0];
        center = _positions[0];

        int sides = 24;

        float d = length(center);
        if(d <= radius) return;

        float x = radius * radius / d;
        vec3 center_prime = center - center * (x / d);
        float radius_prime = sqrt(radius * radius - x * x);
        radius_prime /= cos(3.1415926535897932 / sides);
        radius_prime *= 1.01;
        vec3 up = vec3(0, 1, 1);
        vec3 ex = normalize(cross(center, up));
        vec3 ey = normalize(cross(ex, center));
        ex *= radius_prime;
        ey *= radius_prime;

        vec3 p0 = center_prime + ex;

        for(int i = 0; i <= sides; i++) {
            float t = float(i) / sides * 3.1415926535897932 * 2;
            vec3 p1 = center_prime + ex * cos(t) + ey * sin(t);

            p_prime = center_prime; gl_Position = omni_render(p_prime); EmitVertex();
            p_prime = p1; gl_Position = omni_render(p_prime); EmitVertex();
        }
        EndPrimitive();
    }
`; };

SphereObject.prototype._fragmentShader = function() { return `
    uniform float specular_term = 20;
    uniform vec3 light_position = vec3(0, 0, 0);
    uniform vec4 light_ambient = vec4(0.3, 0.3, 0.3, 1.0);
    uniform vec4 light_diffuse = vec4(0.7, 0.7, 0.7, 1.0);
    uniform vec4 light_specular = vec4(1.0, 1.0, 1.0, 1.0);

    in vec4 color;
    in float radius;
    in vec3 center;
    in vec3 p_prime;

    layout(location = 0) out vec4 fragment_color;

    void main() {
        float qa = dot(p_prime, p_prime);
        float qb = -2.0 * dot(p_prime, center);
        float qc = dot(center, center) - radius * radius;
        float qd = qb * qb - 4.0 * qa * qc;
        if(qd <= 0.0) discard;
        float t = (-qb - sqrt(qd)) / qa / 2.0;

        vec3 p = p_prime * t;

        vec3 N = normalize(p - center);
        vec3 L = normalize(omni_transform(light_position) - p);
        vec3 R = reflect(-L, N);

        vec4 colorMixed = color;
        vec4 final_color = colorMixed * light_ambient;

        float lambertTerm = max(dot(N, L), 0.0);
        final_color += light_diffuse * colorMixed * lambertTerm;
        vec3 E = normalize(-p);
        float spec = pow(max(dot(R, E), 0.0), specular_term);
        final_color += light_specular * spec;
        final_color.a = color.a;
        final_color.rgb *= final_color.a;
        fragment_color = final_color;

        vec4 clip_position = omni_render(p);
        vec3 pixel_position;
        pixel_position.xy = clip_position.xy;
        pixel_position.z = -clip_position.w;
        pixel_position = pixel_position * (length(p) / length(pixel_position));
        float z2 = pixel_position.z * omni_viewport_projection.z + omni_viewport_projection.w;
        gl_FragDepth = (z2 / -pixel_position.z * 0.5 + 0.5);
    }
`; };

SphereObject.prototype.constructor = SphereObject;

shape3d.spheres = function() {
    return new SphereObject();
};


var CubeObject = function() {
    ShapeObject.call(this);
};

CubeObject.prototype = Object.create(ShapeObject.prototype);
CubeObject.prototype._vertexShader = function() { return `
    vec3 center;
    vec3 size;

    out vec4 _colors;
    out vec3 _sizes;
    out vec3 _centers;
    __ATTRIBUTE_LINES__
    void main() {
        computeAttributes();
        _colors = vec4(1, 1, 1, 1);
        _centers = center;
        _sizes = size;
    }
`; };

CubeObject.prototype._geometryShader = function() { return `
    layout(points) in;
    layout(triangle_strip, max_vertices = 50) out;
    in vec4 _colors[1];
    in vec3 _sizes[1];
    in vec3 _centers[1];

    out vec4 color;
    out vec3 normal;
    out vec3 position;

    void main() {
        color = _colors[0];
        vec3 halfsize = _sizes[0] / 2.0;
        vec3 center = _centers[0];

        normal = omni_transform_normal(vec3(1, 0, 0));
        position = omni_transform(vec3(center.x + halfsize.x, center.y + halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x + halfsize.x, center.y + halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x + halfsize.x, center.y - halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x + halfsize.x, center.y - halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        EndPrimitive();

        normal = omni_transform_normal(vec3(-1, 0, 0));
        position = omni_transform(vec3(center.x - halfsize.x, center.y + halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x - halfsize.x, center.y + halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x - halfsize.x, center.y - halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x - halfsize.x, center.y - halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        EndPrimitive();

        normal = omni_transform_normal(vec3(0, 1, 0));
        position = omni_transform(vec3(center.x + halfsize.x, center.y + halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x - halfsize.x, center.y + halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x + halfsize.x, center.y + halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x - halfsize.x, center.y + halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        EndPrimitive();

        normal = omni_transform_normal(vec3(0, -1, 0));
        position = omni_transform(vec3(center.x - halfsize.x, center.y - halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x + halfsize.x, center.y - halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x - halfsize.x, center.y - halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x + halfsize.x, center.y - halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        EndPrimitive();

        normal = omni_transform_normal(vec3(0, 0, 1));
        position = omni_transform(vec3(center.x + halfsize.x, center.y + halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x + halfsize.x, center.y - halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x - halfsize.x, center.y + halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x - halfsize.x, center.y - halfsize.y, center.z + halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        EndPrimitive();

        normal = omni_transform_normal(vec3(0, 0, -1));
        position = omni_transform(vec3(center.x + halfsize.x, center.y - halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x + halfsize.x, center.y + halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x - halfsize.x, center.y - halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        position = omni_transform(vec3(center.x - halfsize.x, center.y + halfsize.y, center.z - halfsize.z));
        gl_Position = omni_render(position); EmitVertex();
        EndPrimitive();

    }
`; };

CubeObject.prototype._fragmentShader = function() { return `
    uniform float specular_term = 20;
    uniform vec3 light_position = vec3(0, 0, 0);
    uniform vec4 light_ambient = vec4(0.3, 0.3, 0.3, 1.0);
    uniform vec4 light_diffuse = vec4(0.7, 0.7, 0.7, 1.0);
    uniform vec4 light_specular = vec4(1.0, 1.0, 1.0, 1.0);

    in vec4 color;
    in vec3 normal;
    in vec3 position;

    layout(location = 0) out vec4 fragment_color;

    void main() {
        vec3 N = normalize(normal);
        vec3 L = normalize(omni_transform(light_position) - position);
        vec3 R = reflect(-L, N);

        vec4 colorMixed = color;
        vec4 final_color = colorMixed * light_ambient;

        float lambertTerm = max(dot(N, L), 0.0);
        final_color += light_diffuse * colorMixed * lambertTerm;
        vec3 E = normalize(-position);
        float spec = pow(max(dot(R, E), 0.0), specular_term);
        final_color += light_specular * spec;
        final_color.a = color.a;
        final_color.rgb *= final_color.a;
        fragment_color = final_color;
    }
`; };

CubeObject.prototype.constructor = CubeObject;

shape3d.cubes = function() {
    return new CubeObject();
};


var TextCache = allofwutils.text.TextCache;

var TextObject = function() {
    ShapeObject.call(this);
    this.text_value = new VariableValue("string", "");
    this.font_value = new VariableValue("object", { family: "Arial", size: 96 });
    this.style_value = new VariableValue("object", { fill: [ 255, 255, 255, 1 ] });

    this.textcache = new TextCache(2048, 2048);
    this.uniform("int", "_texture_w", this.textcache.width);
    this.uniform("int", "_texture_h", this.textcache.height);

    var self = this;

    this.variable("vec4", "_texture_xywh", function(d) {
        var rect = self.data2text.get(d);
        return [ rect.x, rect.y, rect.w, rect.h ];
    });
    this.variable("vec2", "_texture_offset", function(d) {
        var rect = self.data2text.get(d);
        return [ rect.x_offset, rect.baseline_offset ];
    });
};

TextObject.prototype = Object.create(ShapeObject.prototype);

TextObject.prototype.text = function(f) {
    this.text_value = new VariableValue("string", f);
    return this;
};

TextObject.prototype.font = function(f) {
    this.font_value = new VariableValue("object", f);
    return this;
};

TextObject.prototype.style = function(f) {
    this.style_value = new VariableValue("object", f);
    return this;
};

TextObject.prototype.data = function(data) {
    var self = this;
    try {
        self.textcache.updated = false;
        this.data2text = new WeakMap();
        data.forEach(function(d) {
            self.data2text.set(d,
                self.textcache.addText(
                    self.text_value.get(d),
                    self.font_value.get(d),
                    self.style_value.get(d)
                )
            );
        });
    } catch(e) {
        this.textcache.clear();
        self.textcache.updated = true;
        this.data2text = new WeakMap();
        data.forEach(function(d) {
            self.data2text.set(d,
                self.textcache.addText(
                    self.text_value.get(d),
                    self.font_value.get(d),
                    self.style_value.get(d)
                )
            );
        });
    }
    if(self.textcache.updated) {
        this.textcache.surface.uploadTexture();
    }

    ShapeObject.prototype.data.call(this, data);

    return this;
};

TextObject.prototype.compile = function(omni) {
    ShapeObject.prototype.compile.call(this, omni);
    GL.useProgram(this.program.id());
    GL.uniform1i(GL.getUniformLocation(this.program.id(), "texCache"), 1);
    GL.useProgram(0);
    return this;
};

TextObject.prototype.render = function(omni) {
    this.textcache.surface.bindTexture(1);
    ShapeObject.prototype.render.call(this, omni);
    this.textcache.surface.unbindTexture(1);
};


TextObject.prototype._vertexShader = function() { return `
    vec3 center;
    vec3 normal;
    vec3 up;
    float scale;

    out vec3 centers;
    out vec3 normals;
    out vec3 ups;
    out float scales;
    out vec4 t_xywhs;
    // out vec2 t_offsets;

    __ATTRIBUTE_LINES__

    void main() {
        computeAttributes();
        centers = omni_transform(center);
        normals = omni_transform_normal(normalize(normal));
        ups = omni_transform_normal(normalize(up));
        t_xywhs = _texture_xywh;
        // t_offsets = _texture_offset;
        scales = scale;
    }
`; };
TextObject.prototype._geometryShader = function() { return `
    layout(points) in;
    layout(triangle_strip, max_vertices = 4) out;
    in vec3 centers[1];
    in vec3 normals[1];
    in vec3 ups[1];
    in float scales[1];
    in vec4 t_xywhs[1];
    // in vec2 t_offsets[1];

    out vec2 texCoord;

    void main() {
        vec3 p;
        vec3 ex = normalize(cross(ups[0], normals[0]));
        vec3 ey = normalize(cross(normals[0], ex));
        vec2 swh = vec2(scales[0] * t_xywhs[0].z / 2, scales[0] * t_xywhs[0].w / 2);
        vec3 center = centers[0];
        p = center - ex * swh.x + ey * swh.y;
        texCoord = t_xywhs[0].xy;
        gl_Position = omni_render(p);
        EmitVertex();
        p = center + ex * swh.x + ey * swh.y;
        texCoord = t_xywhs[0].xy + vec2(t_xywhs[0].z, 0);
        gl_Position = omni_render(p);
        EmitVertex();
        p = center - ex * swh.x - ey * swh.y;
        texCoord = t_xywhs[0].xy + vec2(0, t_xywhs[0].w);
        gl_Position = omni_render(p);
        EmitVertex();
        p = center + ex * swh.x - ey * swh.y;
        texCoord = t_xywhs[0].xy + t_xywhs[0].zw;
        gl_Position = omni_render(p);
        EmitVertex();
        EndPrimitive();
    }
`; };

TextObject.prototype._fragmentShader = function() { return `
    layout(location = 0) out vec4 fragment_color;
    uniform sampler2D texCache;
    in vec2 texCoord;
    void main() {
        fragment_color = texture(texCache, texCoord / vec2(_texture_w, _texture_h));
        if(fragment_color.a == 0) discard;
   }
`; };

TextObject.prototype.constructor = TextObject;

shape3d.texts = function() {
    return new TextObject();
};


// Display image patches.

var ImageObject = function() {
    ShapeObject.call(this);
};

ImageObject.prototype = Object.create(ShapeObject.prototype);

ImageObject.prototype.xywh = function(f) {
    this.variable("vec4", "_texture_xywh", function(d) {
        var rect = f(d);
        return [ rect.x, rect.y, rect.width, rect.height ];
    });
    return this;
};

ImageObject.prototype.image = function(image, width, height) {
    this.imagetexture = image;
    image.uploadTexture();
    this.uniform("int", "_texture_w", width !== undefined ? width : this.imagetexture.width());
    this.uniform("int", "_texture_h", height !== undefined ? height : this.imagetexture.height());
    return this;
};

ImageObject.prototype.compile = function(omni) {
    ShapeObject.prototype.compile.call(this, omni);
    GL.useProgram(this.program.id());
    GL.uniform1i(GL.getUniformLocation(this.program.id(), "texImage"), 1);
    GL.useProgram(0);
    return this;
};

ImageObject.prototype.render = function(omni) {
    this.imagetexture.bindTexture(1);
    ShapeObject.prototype.render.call(this, omni);
    this.imagetexture.unbindTexture(1);
};


ImageObject.prototype._vertexShader = function() { return [
    "vec3 center;",
    "vec3 normal;",
    "vec3 up;",
    "float scale;",

    "out vec3 centers;",
    "out vec3 normals;",
    "out vec3 ups;",
    "out float scales;",
    "out vec4 t_xywhs;",

    "__ATTRIBUTE_LINES__",

    "void main() {",
    "    computeAttributes();",
    "    centers = omni_transform(center);",
    "    normals = omni_transform_normal(normalize(normal));",
    "    ups = omni_transform_normal(normalize(up));",
    "    t_xywhs = _texture_xywh;",
    "    scales = scale;",
    "}"
].join("\n"); };
ImageObject.prototype._geometryShader = function() { return [
    "layout(points) in;",
    "layout(triangle_strip, max_vertices = 4) out;",
    "in vec3 centers[1];",
    "in vec3 normals[1];",
    "in vec3 ups[1];",
    "in float scales[1];",
    "in vec4 t_xywhs[1];",
    //"in vec2 t_offsets[1];",

    "out vec2 texCoord;",

    "void main() {",
    "    vec3 p;",
    "    vec3 ex = normalize(cross(ups[0], normals[0]));",
    "    vec3 ey = normalize(cross(normals[0], ex));",
    "    vec2 swh = vec2(scales[0] * t_xywhs[0].z / 2, scales[0] * t_xywhs[0].w / 2);",
    "    vec3 center = centers[0];",
    "    p = center - ex * swh.x + ey * swh.y;",
    "    texCoord = t_xywhs[0].xy;",
    "    gl_Position = omni_render(p);",
    "    EmitVertex();",
    "    p = center + ex * swh.x + ey * swh.y;",
    "    texCoord = t_xywhs[0].xy + vec2(t_xywhs[0].z, 0);",
    "    gl_Position = omni_render(p);",
    "    EmitVertex();",
    "    p = center - ex * swh.x - ey * swh.y;",
    "    texCoord = t_xywhs[0].xy + vec2(0, t_xywhs[0].w);",
    "    gl_Position = omni_render(p);",
    "    EmitVertex();",
    "    p = center + ex * swh.x - ey * swh.y;",
    "    texCoord = t_xywhs[0].xy + t_xywhs[0].zw;",
    "    gl_Position = omni_render(p);",
    "    EmitVertex();",
    "    EndPrimitive();",
    "}"
].join("\n"); };

ImageObject.prototype._fragmentShader = function() { return [
    "layout(location = 0) out vec4 fragment_color;",
    "uniform sampler2D texImage;",
    "in vec2 texCoord;",
    "void main() {",
        "fragment_color = texture(texImage, texCoord / vec2(_texture_w, _texture_h));",
        "if(fragment_color.a == 0) discard;",
    "}"
].join("\n"); };

ImageObject.prototype.constructor = ImageObject;

shape3d.images = function() {
    return new ImageObject();
};



})();

var Networking = function(config, role) {
    var self = this;
    this.broadcast = function() { };

    allofwutils.utils.makeEventSource(this);

    if(role == "renderer") {
        var sub = require("zmq").socket("sub");
        sub.connect(config.broadcasting.renderer.sub);
        sub.subscribe("");
        sub.on("message", function(msg) {
            try {
                var obj = JSON.parse(msg);
                self.raise.apply(this, [ obj[0] ].concat(obj[1]));
            } catch(e) {
                console.log(e.stack);
            }
        });
        console.log("Renderer: Listening on " + config.broadcasting.renderer.sub);
    }
    if(role == "simulator") {
        var pub = require("zmq").socket("pub");
        pub.bind(config.broadcasting.simulator.pub);
        console.log("Controller: Braodcasting on " + config.broadcasting.simulator.pub);
        this.broadcast = function(path) {
            try {
                var obj = [ path, Array.prototype.slice.call(arguments, 1) ];
                pub.send(JSON.stringify(obj));
            } catch(e) {
                console.log(e.stack);
            }
        };
    }
};

allofwutils.Networking = Networking;

function HTTPServer(config) {
    var self = this;
    this.handlers = { };

    var express = require("express");
    var app = express();
    var http = require('http').Server(app);
    var io = require('socket.io')(http);

    app.use(express.static(config.http.static));

    http.listen(config.http.port, function() {
        console.log("HTTPServer: Listening on port " + config.http.port);
    });

    this.sockets = new Set();

    io.on('connection', function(socket) {
        console.log("New connection: " + socket.id);
        self.sockets.add(socket);

        socket.on('disconnect', function() {
            console.log("Connection closed: " + socket.id);
            self.sockets.delete(socket);
        });

        socket.on('m', function(msg) {
            try {
                if(self.handlers[msg[0]]) {
                    self.handlers[msg[0]].apply(null, msg[1]);
                }
            } catch(e) {
                console.log(e.stack);
            }
        });
    });

    this.current_message_queue = [];
    setInterval(function() {
        if(self.current_message_queue.length > 0) {
            for(var item of self.sockets) {
                item.emit("ms", self.current_message_queue);
            }
        }
        self.current_message_queue = [];
    }, 200);
}

HTTPServer.prototype.broadcast = function(path) {
    this.current_message_queue.push([ path, Array.prototype.slice.call(arguments, 1) ]);
};

HTTPServer.prototype.on = function(event, handler) {
    this.handlers[event] = handler;
};

allofwutils.HTTPServer = HTTPServer;

function RunAllofwApp(info) {
    var allofw = require("allofw");
    var allofwutils = require("allofwutils");

    var config_file = info.config ? info.config : "allofw.yaml";
    var config = require("js-yaml").load(require("fs").readFileSync(config_file, "utf-8"));
    if(info.role) {
        var role = info.role;
    } else {
        var role = config.role;
    }
    var app_module = info.module;

    function StartRenderer() {
        var GL = allofw.GL3;

        var window = new allofw.OpenGLWindow({ config: config_file });
        window.makeContextCurrent();
        var omni = new allofw.OmniStereo(config_file);
        var networking = new allofwutils.Networking(config, "renderer");
        var nav = new allofwutils.WindowNavigation(window, omni);

        var app = { GL: GL, window: window, omni: omni, config: config, networking: networking };
        var renderer = new app_module.renderer(app);

        // Main rendering code.
        omni.onCaptureViewport(function() {
            GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
            if(renderer.render) renderer.render();
        });

        // Main loop (called by timer below).
        function render() {
            omni.capture();
            sz = window.getFramebufferSize();
            omni.composite(0, 0, sz[0], sz[1]);
            window.swapBuffers();
        }

        timer = setInterval(function() {
            nav.update();
            render();
            window.pollEvents();

            if(window.shouldClose()) {
                clearInterval(timer);
            }
        });

        window.onClose(function() {
            clearInterval(timer);
        });
    }

    function StartSimulator() {
        var allofwutils = require("allofwutils");
        var networking = new allofwutils.Networking(config, "simulator");
        if(config.http) {
            var server = new allofwutils.HTTPServer(config);
        }
        var app = { server: server, config: config, networking: networking };
        var simulator = new app_module.simulator(app);
    }

    if(role == "renderer") {
        StartRenderer();
    }

    if(role == "simulator") {
        StartSimulator();
    }

    if(role == "both") {
        StartRenderer();
        StartSimulator();
    }
}

allofwutils.RunAllofwApp = RunAllofwApp;

