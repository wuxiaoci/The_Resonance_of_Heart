import subprocess as sp
import numpy
import json
import pickle

def ReadFrames(filename, width, height):
    command = [ 'ffmpeg',
                '-loglevel', 'panic',
                '-i', filename,
                '-vf', 'scale=%s:%s' % (width, height),
                '-f', 'image2pipe',
                '-pix_fmt', 'rgb24',
                '-vcodec', 'rawvideo', '-']
    pipe = sp.Popen(command, stdout = sp.PIPE, bufsize=10**8)
    while True:
        raw_image = pipe.stdout.read(width * height * 3)
        if len(raw_image) != width * height * 3:
            break
        image = numpy.fromstring(raw_image, dtype = "uint8")
        image = image.reshape((height, width, 3))
        yield image

    pipe.stdout.flush()

def ConvertVideoToDataset(filename, output_file, width = 32, height = 24, max_frames = 2**30):
    dataset = []

    frames = 0
    old_status = ""

    for frame in ReadFrames("Training1.mov", width, height):
        frame = frame.flatten()
        dataset.append(frame.tolist())
        frames += 1
        status = "%.1f minutes processed." % (frames / 24.0 / 60.0)
        if status != old_status:
            old_status = status
            print status
        if frames >= max_frames:
            break

    bigarray = numpy.asarray(dataset, dtype = "uint8")

    print bigarray.shape


    numpy.save(output_file, bigarray)
    with open(output_file + ".manifest", "wb") as f:
        f.write(json.dumps({
            "width": width,
            "height": height,
            "channels": 3,
            "frames": len(dataset)
        }))
