import os
from typing import Dict, List, Union, Optional


class Codelist:
    """
    A Codelist has two fields:

    :param name: Descriptive name of codelist
    :param codelist: User can enter codelists as either a string, a list of strings
    or a dictionary keyed by code type. In first two cases, the class will convert
    the input to a dictionary with a single key None. All consumers of the Codelist
    instance can then assume the codelist in that format.

    # Initialize with a list
    >> cl = Codelist(
        ['x', 'y', 'z'],
        'mycodelist'
        )
    >> print(cl.codelist)
    {None: ['x', 'y', 'z']}

    # Initialize with string
    >> cl = Codelist(
        'SBP'
        )
    >> print(cl.codelist)
    {None: ['SBP']}

    # Initialize with a dictionary
    >> atrial_fibrillation_icd_codes = {
        "ICD-9": [
            "427.31"  # Atrial fibrillation
        ],
        "ICD-10": [
            "I48.0",  # Paroxysmal atrial fibrillation
            "I48.1",  # Persistent atrial fibrillation
            "I48.2",  # Chronic atrial fibrillation
            "I48.91", # Unspecified atrial fibrillation
        ]
    }
    >> cl = Codelist(
        atrial_fibrillation_icd_codes,
        'atrial_fibrillation',
    )
    >> print(cl.codelist)
    {
        "ICD-9": [
            "427.31"  # Atrial fibrillation
        ],
        "ICD-10": [
            "I48.0",  # Paroxysmal atrial fibrillation
            "I48.1",  # Persistent atrial fibrillation
            "I48.2",  # Chronic atrial fibrillation
            "I48.91", # Unspecified atrial fibrillation
        ]
    }
    """

    def __init__(
        self, codelist: Union[str, List, Dict[str, List]], name: Optional[str] = None
    ) -> None:
        self.name = name
        if isinstance(codelist, dict):
            self.codelist = codelist
        elif isinstance(codelist, list):
            self.codelist = {None: codelist}
        elif isinstance(codelist, str):
            if name is None:
                self.name = codelist
            self.codelist = {None: [codelist]}
        else:
            raise TypeError("Input codelist must be a dictionary, list, or string.")

    @classmethod
    def from_yaml(cls, path: str) -> "Codelist":
        """
        Load a codelist from a yaml file.
        """
        import yaml

        with open(path, "r") as f:
            data = yaml.safe_load(f)
        return cls(
            data, name=os.path.basename(path.replace(".yaml", "").replace(".yml", ""))
        )

    @classmethod
    def from_excel(
        cls,
        path: str,
        sheet_name: Optional[str] = None,
        code_column: Optional[str] = "code",
        code_type_column: Optional[str] = "code_type",
        codelist_column: Optional[str] = None,
        codelist_name: Optional[str] = None,
    ) -> "Codelist":
        """
        Load a codelist from a yaml file.
        """
        import pandas as pd

        if sheet_name is None:
            _df = pd.read_excel(path)
        else:
            xl = pd.ExcelFile(path)
            if sheet_name not in xl.sheet_names:
                raise ValueError(
                    f"Sheet name {sheet_name} not found in the Excel file."
                )
            _df = xl.parse(sheet_name)

        if codelist_name is not None:
            # codelist name is not none, therefore we subset the table to the current codelist
            _df = _df[_df[codelist_column] == codelist_name]

        code_dict = _df.groupby(code_type_column)[code_column].apply(list).to_dict()

        if codelist_name is None:
            name = codelist_name
        elif sheet_name is not None:
            name = sheet_name
        else:
            name = path.split(os.sep)[-1].replace(".xlsx", "")

        return cls(code_dict, name=name)

    def to_tuples(self) -> List[tuple]:
        """
        Convert the codelist to a list of tuples, where each tuple is of the form
        (code_type, code).
        """
        return sum(
            [[(ct, c) for c in self.codelist[ct]] for ct in self.codelist.keys()],
            [],
        )

    def __repr__(self):
        return f"""Codelist(
    name='{self.name}',
    codelist={self.codelist}
)"""


import pandas as pd


class LocalCSVCodelistFactory:
    """ """

    def __init__(
        self,
        path: str,
        name_code_column: str = "code",
        name_codelist_column: str = "codelist",
        name_code_type_column: str = "code_type",
    ) -> None:
        self.path = path
        self.name_code_column = name_code_column
        self.name_codelist_column = name_codelist_column
        self.name_code_type_column = name_code_type_column
        try:
            self.df = pd.read_csv(path)
        except:
            raise ValueError("Could not read the file at the given path.")

    def get_codelist(self, name: str) -> Codelist:
        try:
            df_codelist = self.df[self.df[self.name_codelist_column] == name]
            code_dict = (
                df_codelist.groupby(self.name_code_type_column)[self.name_code_column]
                .apply(list)
                .to_dict()
            )
            return Codelist(name=name, codelist=code_dict)
        except:
            raise ValueError("Could not find the codelist with the given name.")
