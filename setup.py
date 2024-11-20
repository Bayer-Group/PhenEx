from setuptools import setup, find_packages

__version__ = "0.1.0"


# Function to parse requirements.txt
def parse_requirements(filename):
    with open(filename, "r") as file:
        return [
            line.strip() for line in file if line.strip() and not line.startswith("#")
        ]


setup(
    name="phenex",
    version=__version__,
    author="Bayer AG",
    author_email="alexander.hartenstein@bayer.com",
    description="PhenEx is a Python package for analysis-ready datasets from real-world data",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/Bayer-Group/PhenEx",
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: BSD License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.9",
    install_requires=parse_requirements("requirements.txt"),
)
