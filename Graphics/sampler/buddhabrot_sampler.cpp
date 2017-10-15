#include <iostream>
#include <random>
#include <thread>
#include <stdio.h>

struct MandelbrotIterator {
    double cx;
    double cy;
    double zx;
    double zy;

    MandelbrotIterator(double cx_, double cy_) {
        cx = cx_;
        cy = cy_;
        zx = 0;
        zy = 0;
    }

    bool next() {
        double nzx = zx * zx - zy * zy + cx;
        double nzy = zx * zy * 2.0 + cy;
        zx = nzx;
        zy = nzy;
        if(zx * zx + zy * zy > 4) {
            return false;
        } else {
            return true;
        }
    }
};

int cycleDetectSampler(double cx, double cy, int maxIteration, double& czx, double& czy) {
    MandelbrotIterator it1(cx, cy);
    MandelbrotIterator it2(cx, cy);
    for(int i = 0; i < maxIteration; i++) {
        bool valid = true;
        // One step for it1.
        valid &= it1.next();
        // Two steps for it2.
        valid &= it2.next();
        valid &= it2.next();

        if(!valid) break;

        if(it1.zx == it2.zx && it1.zy == it2.zy) {
            // Cycle detected at iteration i
            double zx = it1.zx;
            double zy = it1.zy;
            czx = zx;
            czy = zy;
            for(int j = 0; j < maxIteration; j++) {
                it1.next();
                if(it1.zx == zx && it1.zy == zy) {
                    return j + 1;
                }
            }
            return -1;
        }
    }
    return -1;
}


void generatePoints(float* buffer, int count) {
    std::uniform_real_distribution<double> unif(-2, 2);
    std::random_device re;

    int finished = 0;

    while(finished < count) {
        double zx, zy;
        double cx = unif(re);
        double cy = unif(re);
        int n = cycleDetectSampler(cx, cy, 5000, zx, zy);
        if(n >= 32) {
            MandelbrotIterator it1(cx, cy);
            it1.zx = zx;
            it1.zy = zy;
            for(int i = 0; i < n && finished < count; i += 16) {
                *buffer++ = cx;
                *buffer++ = cy;
                *buffer++ = it1.zx;
                *buffer++ = it1.zy;
                finished++;
                for(int j = 0; j < 16; j++) {
                    it1.next();
                }
            }
        }
    }
}

void generatePointsThreaded(float* buffer, int count, int numThreads) {
    std::vector<std::thread> threads(numThreads);

    for(int i = 0; i < numThreads; i++) {
        threads[i] = std::thread([=](){
            std::cerr << "Thread " << i << " started" << std::endl;
            int blockSize = count / numThreads;
            generatePoints(buffer + blockSize * i, blockSize);
            std::cerr << "Thread " << i << " completed" << std::endl;
        });
    }

    for(int i = 0; i < numThreads; i++) {
        threads[i].join();
    }
}

int main() {
    int totalPoints = 10000000;
    float* buffer = new float[totalPoints * 4];
    generatePointsThreaded(buffer, totalPoints, 16);
    FILE* f = fopen("data.bin", "wb");
    fwrite(buffer, sizeof(float), totalPoints * 4, f);
    fclose(f);
}
