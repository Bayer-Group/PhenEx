import os
from typing import Dict, List, Union, Optional
import pandas as pd
import warnings
from phenex.util.serialization.to_dict import to_dict


class Codelist:
    """
    Codelist is a class that allows us to conveniently work with medical codes used in RWD analyses. A Codelist represents a (single) specific medical concept, such as 'atrial fibrillation' or 'myocardial infarction'. A Codelist is associated with a set of medical codes from one or multiple source vocabularies (such as ICD10CM or CPT); we call these vocabularies 'code types'. Code type is important, as there are no assurances that codes from different vocabularies (different code types) do not overlap. It is therefore highly recommended to always specify the code type when using a codelist.

    Codelist is a simple class that stores the codelist as a dictionary. The dictionary is keyed by code type and the value is a list of codes. Codelist also has various convenience methods such as read from excel, csv or yaml files, and export to excel files.

    Fuzzy codelists allow the use of '%' as a wildcard character in codes. This can be useful when you want to match a range of codes that share a common prefix. For example, 'I48.%' will match any code that starts with 'I48.'. Multiple fuzzy matches can be passed just like ordinary codes in a list.

    If a codelist contains more than 100 fuzzy codes, a warning will be issued as performance may suffer significantly.

    Parameters:
        name: Descriptive name of codelist
        codelist: User can enter codelists as either a string, a list of strings or a dictionary keyed by code type. In first two cases, the class will convert the input to a dictionary with a single key None. All consumers of the Codelist instance can then assume the codelist in that format.
        use_code_type: User can define whether code type should be used or not.
        remove_punctuation: User can define whether punctuation should be removed from codes or not.

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
        self,
        codelist: Union[str, List, Dict[str, List]],
        name: Optional[str] = None,
        use_code_type: Optional[bool] = True,
        remove_punctuation: Optional[bool] = False,
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
            self.use_code_type = use_code_type

        self.remove_punctuation = remove_punctuation

        self.fuzzy_match = False
        for code_type, codelist in self.codelist.items():
            if any(["%" in str(code) for code in codelist]):
                self.fuzzy_match = True
                if len(codelist) > 100:
                    warnings.warn(
                        f"Detected fuzzy codelist match with > 100 regex's for code type {code_type}. Performance may suffer significantly."
                    )

        self._resolved_codelist = None

    def copy(
        self,
        name: Optional[str] = None,
        use_code_type: bool = True,
        remove_punctuation: bool = False,
        rename_code_type: dict = None,
    ) -> "Codelist":
        """
        Codelist's are immutable. If you want to update how codelists are resolved, make a copy of the given codelist changing the resolution parameters.

        Parameters:
            name: Name for newly created code list if different from the old one.
            use_code_type: If False, merge all the code lists into one with None as the key.
            remove_punctuation: If True, remove '.' from all codes.
            rename_code_type: Dictionary defining code types that should be renamed. For example, if the original code type is 'ICD-10-CM', but it is 'ICD10' in the database, we must rename the code type. This keyword argument is a dictionary with keys being the current code type and the value being the desired code type. Code types not included in the mapping are left unchanged.

        Returns:
            Codelist instance with the updated resolution options.
        """
        _codelist = self.codelist.copy()
        if rename_code_type is not None and isinstance(rename_code_type, dict):
            for current, renamed in rename_code_type.items():
                if _codelist.get(current) is not None:
                    _codelist[renamed] = _codelist[current]
                    del _codelist[current]

        return Codelist(
            _codelist,
            name=name or self.name,
            use_code_type=use_code_type,
            remove_punctuation=remove_punctuation,
        )

    @property
    def resolved_codelist(self):
        """
        Retrieve the actual codelists used for filtering after processing for punctuation and code type options (see __init__()).
        """
        if self._resolved_codelist is None:
            resolved_codelist = {}

            for code_type, codes in self.codelist.items():
                if self.remove_punctuation:
                    codes = [code.replace(".", "") for code in codes]
                if self.use_code_type:
                    resolved_codelist[code_type] = codes
                else:
                    if None not in resolved_codelist:
                        resolved_codelist[None] = []
                    resolved_codelist[None] = list(
                        set(resolved_codelist[None]) | set(codes)
                    )
            self._resolved_codelist = resolved_codelist

        return self._resolved_codelist

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

        if codelist_name is not None:
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
        """
        Converts a MedConB style Codelist into a PhenEx style codelist.

        Example:

        ```python
        from medconb_client import Client
        endpoint = "https://api.medconb.example.com/graphql/"
        token = get_token()
        client = Client(endpoint, token)

        medconb_codelist = client.get_codelist(
            codelist_id="9c4ad312-3008-4d95-9b16-6f9b21ec1ad9"
        )
        phenex_codelist = Codelist.from_medconb(medconb_codelist)
        ```
        """
        phenex_codelist = {}
        for codeset in codelist.codesets:
            phenex_codelist[codeset.ontology] = [c[0] for c in codeset.codes]
        return cls(codelist=phenex_codelist, name=codelist.name)

    def to_list(self) -> List[str]:
        """
        Convert the codelist to a flat list of codes, ignoring code types.

        Returns:
            List[str]: A list containing all codes from all code types.
        """
        codes = []
        for code_type, code_list in self.codelist.items():
            codes.extend(code_list)
        return codes

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

    def to_dict(self):
        return to_dict(self)

    def __add__(self, other):
        codetypes = list(set(list(self.codelist.keys()) + list(other.codelist.keys())))
        new_codelist = {}
        for codetype in codetypes:
            new_codelist[codetype] = list(
                set(self.codelist.get(codetype, []) + other.codelist.get(codetype, []))
            )
        if self.remove_punctuation != other.remove_punctuation:
            raise ValueError(
                "Cannot add codelists with non-matching remove_punctuation settings."
            )
        if self.use_code_type != other.use_code_type:
            raise ValueError(
                "Cannot add codelists with non-matching use_code_type settings."
            )

        return Codelist(
            new_codelist,
            name=f"({self.name}_union_{other.name})",
            remove_punctuation=self.remove_punctuation,
            use_code_type=self.use_code_type,
        )

    def __sub__(self, other):
        codetypes = list(self.codelist.keys())
        new_codelist = {}
        for codetype in codetypes:
            new_codelist[codetype] = [
                x
                for x in self.codelist.get(codetype, [])
                if x not in other.codelist.get(codetype, [])
            ]

        if self.remove_punctuation != other.remove_punctuation:
            raise ValueError(
                "Cannot create difference of codelists with non-matching remove_punctuation settings."
            )
        if self.use_code_type != other.use_code_type:
            raise ValueError(
                "Cannot create difference of codelists with non-matching use_code_type settings."
            )

        return Codelist(
            new_codelist,
            name=f"{self.name}_excluding_{other.name}",
            remove_punctuation=self.remove_punctuation,
            use_code_type=self.use_code_type,
        )


class LocalCSVCodelistFactory:
    """
    LocalCSVCodelistFactory allows for the creation of multiple codelists from a single CSV file. Use this class when you have a single CSV file that contains multiple codelists.

    To use, create an instance of the class and then call the `get_codelist` method with the name of the codelist you want to retrieve; this codelist name must be an entry in the name_codelist_column.
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

        # Check if the required columns exist in the DataFrame
        required_columns = [
            name_code_column,
            name_codelist_column,
            name_code_type_column,
        ]
        missing_columns = [
            col for col in required_columns if col not in self.df.columns
        ]
        if missing_columns:
            raise ValueError(
                f"The following required columns are missing in the CSV: {', '.join(missing_columns)}"
            )

    def get_codelists(self) -> List[str]:
        """
        Get a list of all codelists in the supplied CSV.
        """
        return self.df[self.name_codelist_column].unique().tolist()

    def get_codelist(self, name: str) -> Codelist:
        """
        Retrieve a single codelist by name.
        """
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


class MedConBCodelistFactory:
    """
    Retrieve Codelists for use in Phenex from MedConB.

    Example:
    ```python
    from medconb_client import Client
    endpoint = "https://api.medconb.example.com/graphql/"
    token = get_token()
    client = Client(endpoint, token)
    medconb_factory = MedConBCodelistFactory(client)

    phenex_codelist = medconb_factory.get_codelist(
        id="9c4ad312-3008-4d95-9b16-6f9b21ec1ad9"
    )
    ```
    """

    def __init__(
        self,
        medconb_client,
    ):
        self.medconb_client = medconb_client

    def get_codelist(self, id: str):
        """
        Resolve the codelist by querying the MedConB client.
        """
        medconb_codelist = self.medconb_client.get_codelist(codelist_id=id)
        return Codelist.from_medconb(medconb_codelist)

    def get_codelists(self):
        """
        Returns a list of all available codelist IDs.
        """
        return sum(
            [c.items for c in self.medconb_client.get_workspace().collections], []
        )
