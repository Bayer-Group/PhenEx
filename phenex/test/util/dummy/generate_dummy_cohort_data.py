import datetime
import pandas as pd


def generate_dummy_cohort_data(data_dictionary):
    """
    This method creates every possible combination of variables passed in the data dictionary. This is useful for testing all edge cases of a cohort definition.

    Example:
    ```
    inclusion = [
        {
            "name": "entry",
            "values": ["d1", "d4"],
        },{
            "name": "entry_date",
            "values": [datetime.date(2020, 1, 1)],
        },{
            "name":"prior_et_use",
            "values":['e1','e4']
        },{
            "name": "prior_et_use_date",
            "values": [datetime.date(2019, 4, 1)],
        },
    ]
    ```
    will result in

    | **entry** | **entry_date** | **prior_et_use** | **prior_et_use_date** | **PATID** |
    | --- | --- | --- | --- | --- |
    | **d1** | 2020-01-01 | e1 | 2019-04-01 | P0 |
    | **d4** | 2020-01-01 | e1 | 2019-04-01 | P1 |
    | **d1** | 2020-01-01 | e4 | 2019-04-01 | P2 |
    | **d4** | 2020-01-01 | e4 | 2019-04-01 | P3 |


    """
    # create the dataframe with two rows; first patient fulfills entry criteria, second does not
    item = data_dictionary[0]
    df = pd.DataFrame()
    df[item["name"]] = item["values"]

    # iterate over each following criteria, duplicating the previous values
    for item in data_dictionary[1:]:
        _dfs = []
        for value in item["values"]:
            _df = pd.DataFrame(df)
            _df[item["name"]] = value
            _dfs.append(_df)
        df = pd.concat(_dfs)
    # create appropriate patient ids. only patient 0 fulfills all criteria!
    df["PATID"] = [f"P{i}" for i in range(df.shape[0])]
    return df
