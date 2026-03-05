import os
from typing import Dict, List, Union, Optional
import pandas as pd
import warnings
from .codelists import Codelist
from phenex.util.serialization.to_dict import to_dict


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


class MedConBCollection:
    """
    Retrieve Codelists for use in Phenex from a MedConB Collection. Codelists are accessed by name, and the collection name is specified when initializing the factory.

    Example:
    ```python
    from medconb_client import Client
    endpoint = "https://api.medconb.example.com/graphql/"
    token = get_token()
    client = Client(endpoint, token)
    medconb_factory = MedConBCollection(client, "my_collection")

    phenex_codelist = medconb_factory.get_codelist(
        name="atrial_fibrillation"
    )
    ```
    """

    def __init__(self, medconb_client: "Client", collection_name: str):
        self.medconb_client = medconb_client
        self.collection_name = collection_name

    def get_codelist(self, name: str):
        medconb_codelist = self.medconb_client.get_codelist_by_name(
            codelist_name=name,
            codelist_collection_name=self.collection_name,
        )
        return Codelist.from_medconb(medconb_codelist)
