import os
from typing import Dict, List, Union, Optional
import pandas as pd


class Codelist:
    """
    A Codelist has two fields:

    Parameters:
    name: Descriptive name of codelist
    codelist: User can enter codelists as either a string, a list of strings
    or a dictionary keyed by code type. In first two cases, the class will convert
    the input to a dictionary with a single key None. All consumers of the Codelist
    instance can then assume the codelist in that format.

    Example: 
    ```python
    # Initialize with a list
    cl = Codelist(
        ['x', 'y', 'z'],
        'mycodelist'
        )
    print(cl.codelist)
    {None: ['x', 'y', 'z']}
    ```

    Example:
    ```python
    # Initialize with string
    cl = Codelist(
        'SBP'
        )
    print(cl.codelist)
    {None: ['SBP']}
    ```
    
    Example:
    ```python
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
    cl = Codelist(
        atrial_fibrillation_icd_codes,
        'atrial_fibrillation',
    )
    print(cl.codelist)
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
    ```
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

        The YAML file should contain a dictionary where the keys are code types
        (e.g., "ICD-9", "ICD-10") and the values are lists of codes for each type.

        Example:
        ```yaml
        ICD-9:
          - "427.31"  # Atrial fibrillation
        ICD-10:
          - "I48.0"   # Paroxysmal atrial fibrillation
          - "I48.1"   # Persistent atrial fibrillation
          - "I48.2"   # Chronic atrial fibrillation
          - "I48.91"  # Unspecified atrial fibrillation
        ```

        Parameters:
            path: Path to the YAML file.

        Returns:
            Codelist instance.
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
        codelist_name: Optional[str] = None,
        code_column: Optional[str] = "code",
        code_type_column: Optional[str] = "code_type",
        codelist_column: Optional[str] = "codelist",
    ) -> "Codelist":
        """
        Load a codelist from an Excel file.

        The Excel file should contain columns for code types, codes, and optionally
        codelist names. Each row represents a code entry.

        The codelists can be in one sheet or spread across multiple sheets:

        1. Single Sheet:
        If all codelists are in one sheet, the sheet should have a column for codelist names.
        Use codelist_name to point to the specific codelist of interest.

        Example:
        ```markdown
        | code_type | code   | codelist           |
        |-----------|--------|--------------------|
        | ICD-9     | 427.31 | atrial_fibrillation|
        | ICD-10    | I48.0  | atrial_fibrillation|
        | ICD-10    | I48.1  | atrial_fibrillation|
        | ICD-10    | I48.2  | atrial_fibrillation|
        | ICD-10    | I48.91 | atrial_fibrillation|
        ```
        
        2. Multiple Sheets:
        If codelists are spread across multiple sheets, each sheet should represent a single codelist.
        Use sheet_name to point to the specific codelist of interest.
        
        Example:
        ```markdown
        | code_type | code   |
        |-----------|--------|
        | ICD-9     | 427.31 |
        | ICD-10    | I48.0  |
        | ICD-10    | I48.1  |
        | ICD-10    | I48.2  |
        | ICD-10    | I48.91 |
        ```
        
        Parameters:
            path: Path to the Excel file.
            sheet_name: An optional label for the sheet to read from. If defined, the codelist will be taken from that sheet. If no sheet_name is defined, the first sheet is taken.
            codelist_name: An optional name of the codelist which to extract. If defined, codelist_column must be present and the codelist_name must occur within the codelist_column.
            code_column: The name of the column containing the codes.
            code_type_column: The name of the column containing the code types.
            codelist_column: The name of the column containing the codelist names.

        Returns:
            Codelist instance.
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

    def to_pandas(self) -> pd.DataFrame:
        """
        Convert the codelist to a pandas DataFrame.
        """

        _df = pd.DataFrame(self.to_tuples(), columns=["code_type", "code"])
        _df['codelist'] = self.name
        return _df



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
