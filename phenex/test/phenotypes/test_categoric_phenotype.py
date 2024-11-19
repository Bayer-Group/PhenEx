# import datetime, os
# import pandas as pd

# from phenex.phenotypes.categorical_phenotype import CategoricalPhenotype

# from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
# from phenex.filters.value import *


# class CategoricalPhenotypeTestGenerator(PhenotypeTestGenerator):
#     name_space = "cgpt"

#     def define_input_tables(self):
#         def add_flag(df, flag_name, flag_values):
#             dfs = []
#             for flag in flag_values:
#                 _df = df.copy()
#                 _df[flag_name] = flag
#                 dfs.append(_df)
#             return pd.concat(dfs)

#         df = pd.DataFrame()
#         df["PERSON_ID"] = ["p1"]
#         df["CODE"] = ["c1"]
#         df["CODE_TYPE"] = ["ICD10CM"]
#         df = add_flag(df, "x", ["x1", "x2"])
#         df = add_flag(df, "y", ["y1", "y2"])
#         df = add_flag(df, "z", ["z1", "z2"])
#         df["PERSON_ID"] = [f"P{i}" for i in range(df.shape[0])]

#         return [{"condition_occurrence": "input", "df": df, "column_types": {}}]

#     def define_phenotype_tests(self):
#         c1 = {
#             "name": "single_flag",
#             "persons": [f"P{i}" for i in range(4)],
#             "phenotype": CategoricalPhenotype(
#                 name_space=self.name_space,
#                 domain="condition_occurrence",
#                 categorical_filter=CategoricalFilter(
#                     allowed_values=["z1"], columnname="z"
#                 ),
#             ),
#         }

#         c2 = {
#             "name": "two_categorical_filter_or",
#             "persons": [f"P{i}" for i in range(4)] + [f"P{i}" for i in range(6, 8)],
#             "phenotype": CategoricalPhenotype(
#                 name_space=self.name_space,
#                 domain="condition_occurrence",
#                 categorical_filter=CategoricalFilter(
#                     allowed_values=["z1"], columnname="z"
#                 )
#                 | CategoricalFilter(allowed_values=["y2"], columnname="y"),
#             ),
#         }

#         c3 = {
#             "name": "two_categorical_filter_and",
#             "persons": [f"P{i}" for i in range(2, 4)],
#             "phenotype": CategoricalPhenotype(
#                 name_space=self.name_space,
#                 domain="condition_occurrence",
#                 categorical_filter=CategoricalFilter(
#                     allowed_values=["z1"], columnname="z"
#                 )
#                 & CategoricalFilter(allowed_values=["y2"], columnname="y"),
#             ),
#         }

#         test_infos = [c1, c2, c3]
#         for test_info in test_infos:
#             test_info["refactor"] = True  # TODO remove once refactored
#             test_info["phenotype"].name_phenotype = test_info["name"]

#         return test_infos


# def test_categorical_phenotype():
#     spg = CategoricalPhenotypeTestGenerator()
#     spg.run_tests()


# if __name__ == "__main__":
#     test_categorical_phenotype()
