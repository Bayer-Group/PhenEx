## Setup environment

We strongly suggest to install PhenEx in an isolated python virtual environment using your favorite package manager, such as [condas](https://conda.io/projects/conda/en/latest/user-guide/install/index.html) or (pyenv)[https://github.com/pyenv/pyenv]. PhenEx requires Python 3.9 or above. After setting up and activating your virtual environment, move on to the next step.

## Source installation

The code can currently only be installed from git source. To install the code, first clone the repository:

```
git clone git@github.com:Bayer-Group/PhenEx.git
```

Then, change into the directory containing the code:

```
cd PhenEx
```

Use these instructions if you do not plan to change code within PhenEx.

After activating the virtual environment, install the required dependencies with

```
pip install -r requirements.txt
```

and install PhenEx with

```
pip install .
```

### Running the tests

A good way to check your source installation is to run the extensive test suite that PhenEx comes with. You can do so by running:

```
pytest
```

from the root directory of the project.

## Installing Jupyter

If you wish to use PhenEx within a Jupyter notebook, you can install the Jupyter kernel with

```
python3.12 -m ipykernel install --user --name phenex --display-name "PhenEx"
```

That's it! Proceed to the [tutorials](tutorials.md).

## Pip installation

Coming soon!

## Check installation

Check that the installation has succeeded:

```
python3.12 -c "import phenex;print(phenex.__version__)"
```

This will display the installed version of PhenEx.
