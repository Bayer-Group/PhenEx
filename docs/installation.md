## Setup environment

Before installing, it is best to use a separate virtual environment for the installation. You can create a conda virtual environment as follows:

```
conda create -n phenex python=3.12
```

If you do not have condas, you can install it by following the instructions `here <https://conda.io/projects/conda/en/latest/user-guide/install/index.html>`\_.
phenx requires Python 3.9 or above.

To use the virtual environment, activate it:

```
conda activate phenex
```

With condas, sometimes you have explicitly reference python3.12; to avoid this, you can set up an alias:

```
alias python=python3.12
```

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
