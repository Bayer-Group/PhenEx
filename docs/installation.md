# Installation Instructions

## Setup environment

We strongly suggest to install PhenEx in an isolated python virtual environment using your favorite package
manager, such as [condas](https://conda.io/projects/conda/en/latest/user-guide/install/index.html) or
[pyenv](https://github.com/pyenv/pyenv). PhenEx requires Python 3.9 or above. After setting up and activating
your virtual environment, move on to the next step.

## Pip installation

Coming soon!

## Source installation

To install from source, run the following from within your virtual environment:

```
git clone git@github.com:Bayer-Group/PhenEx.git && \
    cd PhenEx && \
    pip install -r requirements.txt && \
    pip install .
```

This will clone the repository and build all the required dependencies.

## Installing Jupyter

If you wish to use PhenEx within a Jupyter notebook, you can install the Jupyter kernel with

```
python -m ipykernel install --user --name phenex --display-name "PhenEx"
```

where `--name phenex` specifies the name of your virtual environment.

## Check installation

Check that the installation has succeeded, run:

```
python -c "import phenex;print(phenex.__version__)"
```

This will display the installed version of PhenEx.

## Now what?

That's it! Proceed to the [tutorials](tutorials.md).
