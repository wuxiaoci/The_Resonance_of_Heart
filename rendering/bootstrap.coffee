points_to_generate = 100000
max_iterate = 10000

n_points = 0
n_fail = 0

buffer = new Buffer(4 * points_to_generate * 4)
buffer_fail = new Buffer(4 * points_to_generate * 4)

rand_float = () -> Math.random() * 4 - 2

old_percentage = 0

while n_points < points_to_generate
    cx = rand_float()
    cy = rand_float()
    z0x = rand_float()
    z0y = rand_float()
    z0x = 0
    z0y = 0

    # Iterate over and see if converge.
    i = 0
    zx = z0x
    zy = z0y
    while i < max_iterate
        z1x = zx * zx - zy * zy + cx
        z1y = 2 * zx * zy + cy
        zx = z1x
        zy = z1y
        len2 = z1x * z1x + z1y * z1y
        if len2 > 4
            break
        i += 1

    if i < max_iterate && i > 512
        buffer.writeFloatLE(cx, (n_points * 4 + 0) * 4)
        buffer.writeFloatLE(cy, (n_points * 4 + 1) * 4)
        buffer.writeFloatLE(z0x, (n_points * 4 + 2) * 4)
        buffer.writeFloatLE(z0y, (n_points * 4 + 3) * 4)
        n_points += 1
        percentage = Math.round(n_points / points_to_generate * 100)
        if percentage - old_percentage > 0
            console.log(percentage)
            old_percentage = percentage
    else if i < max_iterate
        if n_fail < points_to_generate
            buffer_fail.writeFloatLE(cx, (n_fail * 4 + 0) * 4)
            buffer_fail.writeFloatLE(cy, (n_fail * 4 + 1) * 4)
            buffer_fail.writeFloatLE(z0x, (n_fail * 4 + 2) * 4)
            buffer_fail.writeFloatLE(z0y, (n_fail * 4 + 3) * 4)
        n_fail += 1


ratio = n_points / n_fail
console.log(ratio)

require("fs").writeFileSync("data.bin", Buffer.concat([buffer, buffer_fail]))
