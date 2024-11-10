# import pytest
# import ibis
# import pandas as pd
# from datetime import date
# from phenx.phenotypes.multiple_occurrences_phenotype import MultipleOccurrencePhenotype
# from phenx.phenotypes.phenotype import Phenotype
# from phenx.filters.date_range_filter import DateRangeFilter
# from phenx.filters.relative_time_range_filter import RelativeTimeRangeFilter
# from phenx.phenotypes.test.mock_phenotype import MockPhenotype

# @pytest.fixture
# def setup_tables():
#     # Create a DuckDB or in-memory Ibis backend
#     con = ibis.duckdb.connect()

#     # Create a fake condition occurrence table
#     condition_data = {
#         'PERSON_ID': [1, 1, 2, 2, 2, 3, 4, 4, 5, 5, 5],
#         'EVENT_DATE': [
#             date(2020, 1, 1),
#             date(2020, 6, 15),
#             date(2020, 12, 31),
#             date(2020, 7, 20),
#             date(2020, 3, 10),
#             date(2021, 1, 1),
#             date(2021, 6, 15),
#             date(2021, 12, 31),
#             date(2021, 7, 20),
#             date(2021, 3, 10),
#             date(2021, 1, 1)
#         ]
#     }
#     condition_df = pd.DataFrame(condition_data)
#     con.create_table('condition_occurrence', condition_df)
#     condition_table = con.table('condition_occurrence')

#     tables = {
#         'CONDITION_OCCURRENCE': condition_table
#     }

#     return tables

# @pytest.fixture
# def setup_phenotype():
#     # Create a mock phenotype
#     mock_data = {
#         'PERSON_ID': [1, 1, 2, 2, 2, 3, 4, 4, 5, 5, 5],
#         'EVENT_DATE': [
#             date(2020, 1, 1),
#             date(2020, 6, 15),
#             date(2020, 12, 31),
#             date(2020, 7, 20),
#             date(2020, 3, 10),
#             date(2021, 1, 1),
#             date(2021, 6, 15),
#             date(2021, 12, 31),
#             date(2021, 7, 20),
#             date(2021, 3, 10),
#             date(2021, 1, 1)
#         ]
#     }
#     mock_df = pd.DataFrame(mock_data)
#     mock_phenotype = MockPhenotype(mock_df)
#     return mock_phenotype

# #### Unit Tests
# def test_multiple_occurrences_with_min_occurrences(setup_tables, setup_phenotype):
#     tables = setup_tables
#     phenotype = setup_phenotype
#     multiple_occurrences = MultipleOccurrencePhenotype(
#         name="test_multiple_occurrences",
#         phenotype=phenotype,
#         n_occurrences=2
#     )
#     result_table = multiple_occurrences.execute(tables)
#     result_df = result_table.execute()

#     expected_person_ids = [1, 2, 4, 5]
#     assert set(result_df['PERSON_ID'].values) == set(expected_person_ids)
#     assert len(result_df) == len(expected_person_ids)

# def test_multiple_occurrences_with_date_range(setup_tables, setup_phenotype):
#     tables = setup_tables
#     phenotype = setup_phenotype
#     date_range = DateRangeFilter(start_date="2020-01-01", end_date="2020-12-31")
#     multiple_occurrences = MultipleOccurrencePhenotype(
#         name="test_multiple_occurrences",
#         phenotype=phenotype,
#         n_occurrences=2,
#         date_range=date_range
#     )
#     result_table = multiple_occurrences.execute(tables)
#     result_df = result_table.execute()

#     expected_person_ids = [1, 2]
#     assert set(result_df['PERSON_ID'].values) == set(expected_person_ids)
#     assert len(result_df) == len(expected_person_ids)

# def test_multiple_occurrences_with_relative_time_range(setup_tables, setup_phenotype):
#     tables = setup_tables
#     phenotype = setup_phenotype
#     relative_time_range = RelativeTimeRangeFilter(min_days=0, max_days=365)
#     multiple_occurrences = MultipleOccurrencePhenotype(
#         name="test_multiple_occurrences",
#         phenotype=phenotype,
#         n_occurrences=2,
#         relative_time_range=relative_time_range
#     )
#     result_table = multiple_occurrences.execute(tables)
#     result_df = result_table.execute()

#     expected_person_ids = [1, 2, 4, 5]
#     assert set(result_df['PERSON_ID'].values) == set(expected_person_ids)
#     assert len(result_df) == len(expected_person_ids)

# def test_multiple_occurrences_with_first_event_date(setup_tables, setup_phenotype):
#     tables = setup_tables
#     phenotype = setup_phenotype
#     multiple_occurrences = MultipleOccurrencePhenotype(
#         name="test_multiple_occurrences",
#         phenotype=phenotype,
#         n_occurrences=2,
#         return_date='first'
#     )
#     result_table = multiple_occurrences.execute(tables)
#     result_df = result_table.execute()

#     expected_dates = [date(2020, 1, 1), date(2020, 12, 31), date(2021, 6, 15), date(2021, 7, 20)]
#     assert set(result_df['EVENT_DATE'].values) == set(expected_dates)

# def test_multiple_occurrences_with_last_event_date(setup_tables, setup_phenotype):
#     tables = setup_tables
#     phenotype = setup_phenotype
#     multiple_occurrences = MultipleOccurrencePhenotype(
#         name="test_multiple_occurrences",
#         phenotype=phenotype,
#         n_occurrences=2,
#         return_date='last'
#     )
#     result_table = multiple_occurrences.execute(tables)
#     result_df = result_table.execute()

#     expected_dates = [date(2020, 6, 15), date(2020, 7, 20), date(2021, 12, 31), date(2021, 3, 10)]
#     assert set(result_df['EVENT_DATE'].values) == set(expected_dates)
