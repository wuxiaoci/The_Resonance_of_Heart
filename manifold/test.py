from scripts import ReadFrames, ConvertVideoToDataset

# from matplotlib import pyplot as plt
# for frame in ReadFrames("Training1.mov", 64, 48):
#     plt.imshow(frame)
#     plt.show()
#     break

ConvertVideoToDataset("Training1.mov", "Training1.data", width = 64, height = 48)
