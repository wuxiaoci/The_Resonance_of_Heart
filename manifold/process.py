import numpy as np

from sklearn.decomposition import PCA
from sklearn.manifold import Isomap
from sklearn.manifold import MDS
from matplotlib import pyplot as plt

data = np.load("Training1.data.npy")

ids = range(len(data))
np.random.shuffle(ids)
ids = ids[:10000]
data = data[ids]

# print data.shape

model = PCA(n_components = 2)
model.fit(data)
xy = model.transform(data)

# model2 = Isomap(n_components = 2, n_neighbors = 20)
# model2.fit(pca32)

# xy = model2.transform(pca32)


plt.scatter(xy[:,0], xy[:,1])
plt.show()
