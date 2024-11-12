# How to contribute

You can contribute to this project in two ways:

1.  **Reporting bugs** and **suggesting enhancements** by opening an issue.
2.  **Contributing to the codebase** by opening a pull request.

## Reporting bugs and suggesting enhancements

To report a bug or suggest an enhancement, open an issue on the [Issues]. If
reporting a bug, please provide a detailed description of the problem, including
the steps to reproduce it. If suggesting an enhancement, please provide a clear
description of the proposed change, including the use case for the change.

## Contributing to the codebase

To contribute to the codebase, open a pull request on the [Pull Requests](https://github.com/Bayer-Group/PhenEx/pulls).

All pull requests must be approved by at least one reviewer. If there is a
dispute regarding a pull request, a second reviewer will be asked to review the
pull request and make the final decision.

A pull request can and should be rejected if any of the following apply:

- Existing tests have not been run and passed
- The code does not follow the project's coding conventions
- New functionality has not been documented
- Tests for new functionality have not been written
- The pull request is too large
- The pull request addresses more than one issue
- The pull request breaks code that was previously working

It is the responsibility of the contributor to ensure that the pull request meets
all these conditions. If the pull request is rejected, the contributor should
address the issues raised and open a new pull request.

## Coding conventions

Unless specified otherwise here, the codebase follows the [PEP 8](https://peps.python.org/pep-0008/)
style guide for Python code.

We use snake_case for variable, function and method names, and CamelCase for
class names. Method names should be descriptive and generally start with a verb.
Methods should be private unless there is good reason for them to be public. A
higher standard is expected for documentation of public methods, since these
directly face the user, and changes to public methods require higher level of
scrutiny. But this does not mean that private methods should be undocumented if
they provide crucial functionality.
