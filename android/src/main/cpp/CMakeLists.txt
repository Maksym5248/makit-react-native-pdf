cmake_minimum_required(VERSION 3.22.1)
project(ammopdfrotation)
add_library(ammopdfrotation SHARED rotation.cpp)
target_link_libraries(ammopdfrotation dl)
target_compile_features(ammopdfrotation PRIVATE cxx_std_17)

# Support Android devices with 16 KB memory pages.
target_link_options(ammopdfrotation PRIVATE "-Wl,-z,max-page-size=16384")
