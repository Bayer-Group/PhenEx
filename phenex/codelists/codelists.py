import os
from typing import Dict, List, Union, Optional
import pandas as pd
import warnings


class Codelist:
    """
    Codelist is a class that allows us to conveniently work with medical codes used in RWD analyses. A Codelist represents a (single) specific medical concept, such as 'atrial fibrillation' or 'myocardial infarction'. A Codelist is associated with a set of medical codes from one or multiple source vocabularies (such as ICD10CM or CPT); we call these vocabularies 'code types'. Code type is important, as there are no assurances that codes from different vocabularies (different code types) do not overlap. It is therefore highly recommended to always specify the code type when using a codelist.

    Codelist is a simple class that stores the codelist as a dictionary. The dictionary is keyed by code type and the value is a list of codes. Codelist also has various convenience methods such as read from excel, csv or yaml files, and export to excel files.

    Fuzzy codelists allow the use of '%' as a wildcard character in codes. This can be useful when you want to match a range of codes that share a common prefix. For example, 'I48.%' will match any code that starts with 'I48.'. Multiple fuzzy matches can be passed just like ordinary codes in a list.

    If a codelist contains more than 100 fuzzy codes, a warning will be issued as performance may suffer significantly.

    Parameters:
        name: Descriptive name of codelist
        codelist: User can enter codelists as either a string, a list of strings or a dictionary keyed by code type. In first two cases, the class will convert the input to a dictionary with a single key None. All consumers of the Codelist instance can then assume the codelist in that format.

    Methods:
        from_yaml: Load a codelist from a YAML file.
        from_excel: Load a codelist from an Excel file.
        from_csv: Load a codelist from a CSV file.

    File Formats:
        YAML:
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

        Excel:
        The Excel file should contain a minimum of two columns for code and code_type. If multiple codelists exist in the same table, an additional column for codelist names is required.

        Example (Single codelist):
        ```markdown
        | code_type | code   |
        |-----------|--------|
        | ICD-9     | 427.31 |
        | ICD-10    | I48.0  |
        | ICD-10    | I48.1  |
        | ICD-10    | I48.2  |
        | ICD-10    | I48.91 |
        ```

        Example (Multiple codelists):
        ```markdown
        | code_type | code   | codelist           |
        |-----------|--------|--------------------|
        | ICD-9     | 427.31 | atrial_fibrillation|
        | ICD-10    | I48.0  | atrial_fibrillation|
        | ICD-10    | I48.1  | atrial_fibrillation|
        | ICD-10    | I48.2  | atrial_fibrillation|
        | ICD-10    | I48.91 | atrial_fibrillation|
        ```

        CSV:
        The CSV file should follow the same format as the Excel file, with columns for code, code_type, and optionally codelist names.

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

    ```python
    # Initialize with a fuzzy codelist
    anemia = Codelist(
        {'ICD10CM': ['D55%', 'D56%', 'D57%', 'D58%', 'D59%', 'D60%']},
        {'ICD9CM': ['284%', '285%', '282%']},
        'fuzzy_codelist'
    )
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

        if list(self.codelist.keys()) == [None]:
            self.use_code_type = False
        else:
            self.use_code_type = True

        self.fuzzy_match = False
        for code_type, codelist in self.codelist.items():
            if any(["%" in str(code) for code in codelist]):
                self.fuzzy_match = True
                if len(codelist) > 100:
                    warnings.warn(
                        f"Detected fuzzy codelist match with > 100 regex's for code type {code_type}. Performance may suffer significantly."
                    )

    def resolve(
        self, use_code_type: bool = True, remove_punctuation: bool = False
    ) -> "Codelist":
        """
        Resolve the codelist based on the provided arguments.

        Parameters:
            use_code_type: If False, merge all the code lists into one with None as the key.
            remove_punctuation: If True, remove '.' from all codes.

        Returns:
            Codelist instance with the resolved codelist.
        """
        resolved_codelist = {}

        for code_type, codes in self.codelist.items():
            if remove_punctuation:
                codes = [code.replace(".", "") for code in codes]
            if use_code_type:
                resolved_codelist[code_type] = codes
            else:
                if None not in resolved_codelist:
                    resolved_codelist[None] = []
                resolved_codelist[None] = list(
                    set(resolved_codelist[None]) | set(codes)
                )

        return Codelist(resolved_codelist, name=self.name)

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
         Load a single codelist located in an Excel file.

         It is required that the Excel file contains a minimum of two columns for code and code_type. The actual columnnames can be specified using the code_column and code_type_column parameters.

         If multiple codelists exist in the same excel table, the codelist_column and codelist_name are required to point to the specific codelist of interest.

         It is possible to specify the sheet name if the codelist is in a specific sheet.

         1. Single table, single codelist : The table (whether an entire excel file, or a single sheet in an excel file) contains only one codelist. The table should have columns for code and code_type.

             ```markdown
             | code_type | code   |
             |-----------|--------|
             | ICD-9     | 427.31 |
             | ICD-10    | I48.0  |
             | ICD-10    | I48.1  |
             | ICD-10    | I48.2  |
             | ICD-10    | I48.91 |
             ```

        2. Single table, multiple codelists: A single table (whether an entire file, or a single sheet in an excel file) contains multiple codelists. A column for the name of each codelist is required. Use codelist_name to point to the specific codelist of interest.

             ```markdown
             | code_type | code   | codelist           |
             |-----------|--------|--------------------|
             | ICD-9     | 427.31 | atrial_fibrillation|
             | ICD-10    | I48.0  | atrial_fibrillation|
             | ICD-10    | I48.1  | atrial_fibrillation|
             | ICD-10    | I48.2  | atrial_fibrillation|
             | ICD-10    | I48.91 | atrial_fibrillation|
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

    @classmethod
    def from_csv(
        cls,
        path: str,
        codelist_name: Optional[str] = None,
        code_column: Optional[str] = "code",
        code_type_column: Optional[str] = "code_type",
        codelist_column: Optional[str] = "codelist",
    ) -> "Codelist":
        _df = pd.read_csv(path)

        if codelist_name is not None:
            # codelist name is not none, therefore we subset the table to the current codelist
            _df = _df[_df[codelist_column] == codelist_name]

        code_dict = _df.groupby(code_type_column)[code_column].apply(list).to_dict()

        if codelist_name is None:
            name = codelist_name
        else:
            name = path.split(os.sep)[-1].replace(".csv", "")

        return cls(code_dict, name=name)

    @classmethod
    def from_medconb(cls, codelist):
        '''
        Converts a MedConB style Codelist into a PhenEx style codelist.
        '''
        phenex_codelist = {}
        for codeset in codelist.codesets:
            phenex_codelist[codeset.ontology] = [c[0] for c in codeset.codes]
        return cls(codelist=phenex_codelist, name=codelist.name)

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
        Export the codelist to a pandas DataFrame. The DataFrame will have three columns: code_type, code, and codelist.
        """

        _df = pd.DataFrame(self.to_tuples(), columns=["code_type", "code"])
        _df["codelist"] = self.name
        return _df


class LocalCSVCodelistFactory:
    """
    LocalCSVCodelistFactory allows for the creation of multiple codelists from a single CSV file. Use this class when you have a single CSV file that contains multiple codelists.

    To use, create an instance of the class and then call the `create_codelist` method with the name of the codelist you want to create; this codelist name must be an entry in the name_code_type_column.
    """

    def __init__(
        self,
        path: str,
        name_code_column: str = "code",
        name_codelist_column: str = "codelist",
        name_code_type_column: str = "code_type",
    ) -> None:
        """
        Parameters:
            path: Path to the CSV file.
            name_code_column: The name of the column containing the codes.
            name_codelist_column: The name of the column containing the codelist names.
            name_code_type_column: The name of the column containing the code types.
        """
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
