import os
import pandas as pd
import yaml
import datetime
from phenex.test.util.dummy.create_medical_codes_table import (
    create_dummy_medical_codes_data,
)

import random


def generate_input_simplephenotype():
    dirpaths = setup_seedir_for_phenotype("simplephenotype")

    with open("./dbt_project.yml", "r") as f:
        columnnames = yaml.safe_load(f)["vars"]["harmonized"]
    df, tt = sdf_and_tt_dummycodes_3variables(
        code_columnname=columnnames["code"],
        patientid_columnname=columnnames["person_id"],
        code_type_columnname=columnnames["code_type"],
    )
    path = os.path.join(dirpaths["input"], "simplephenotype_input.csv")
    df.to_csv(path, index=False)
    print(path)


def sdf_and_tt_dummycodes_3variables(
    verbose=False,
    code_columnname="code",
    patientid_columnname="person_id",
    code_type_columnname="code_type",
    event_date_columnname="event_date",
):
    """
    Actual return sdf looks as follows :
    P1 c1
    P1 c2
    P1 c3
    P2 c1
    P2 c2
    P3 c1
    P3 c3
    P4 c1
    P5 c2
    P5 c3
    P5 c2
    P6 c2
    P7 c3

    This is created by the following truth table, all possible combinations :
    patid
    P1   c1   c2   c3
    P2   c1   c2
    P3   c1        c3
    P4   c1
    P5        c2   c3
    P6        c2
    P7             c3
    P8

    All possible logical expressions are as follows :
    c1 = P1, P2, P3, P4
    c2 = P1, P2, P5, P6
    c3 = P1, P3, P5, P7
    c1|c2 = P1, P2, P3, P4, P5, P6
    c1|c3 = P1, P2, P3, P4, P5, P7
    c2|c3 = P1, P2, P3, P5, P6, P7
    c1+c2 = P1, P2
    c1+c3 = P1, P3
    c2+c3 = P1, P5
    c1|c2|c3 = P1, P2, P3, P4, P5, P6, P7
    c1+c2+c3 = P1
    """
    df, tt = create_dummy_medical_codes_data(
        3, patientid_columnname=patientid_columnname, code_columnname=code_columnname
    )
    df[code_type_columnname] = "ICD10CM"
    df[event_date_columnname] = datetime.datetime.strptime("01-01-2022", "%m-%d-%Y")
    return df, tt


def get_3code_sdf_duplicated_vertically(spark, verbose=False):
    df, tt = create_dummy_medical_codes_data(3)
    df = pd.concat([df, df], ignore_index=True)
    df["vals"] = range(df.shape[0])
    sdf = spark.createDataFrame(df)
    sdf_patids = sdf.select("patid").distinct()
    if verbose:
        sdf.show(sdf.count())
    return sdf, sdf_patids


def get_3code_sdf_duplicated_vertically_with_inoutpatient(spark, verbose=False):
    df, tt = create_dummy_medical_codes_data(3)
    n = df.shape[0]
    df = pd.concat([df, df], ignore_index=True)
    df["vals"] = range(df.shape[0])
    df["inpatient"] = [0] * n + [
        1
    ] * n  # all of first set are not inpatient, are of second are
    sdf = spark.createDataFrame(df)
    sdf_patids = sdf.select("patid").distinct()
    if verbose:
        sdf.show(sdf.count())
    return sdf, sdf_patids


def get_3code_sdf_patids_with_inpatient_flag(spark, flagvalue, verbose=False):
    """
    All possible combinations of 3 codes, so 7 patients. Duplicated, so each patient
    has two entries for each code.
    CategoricalFilter value is all the same and can be user defined
    +-----+----+----+---------+
    |patid|code|vals|inpatient|
    +-----+----+----+---------+
    |   P1|  c1|   0|        0|
    |   P1|  c2|   1|        0|
    |   P1|  c3|   2|        0|
    |   P2|  c1|   3|        0|
    |   P2|  c2|   4|        0|
    |   P3|  c1|   5|        0|
    |   P3|  c3|   6|        0|
    |   P4|  c1|   7|        0|
    |   P5|  c2|   8|        0|
    |   P5|  c3|   9|        0|
    |   P6|  c2|  10|        0|
    |   P7|  c3|  11|        0|
    |   P1|  c1|  12|        0|
    |   P1|  c2|  13|        0|
    |   P1|  c3|  14|        0|
    |   P2|  c1|  15|        0|
    |   P2|  c2|  16|        0|
    |   P3|  c1|  17|        0|
    |   P3|  c3|  18|        0|
    |   P4|  c1|  19|        0|
    |   P5|  c2|  20|        0|
    |   P5|  c3|  21|        0|
    |   P6|  c2|  22|        0|
    |   P7|  c3|  23|        0|
    +-----+----+----+---------+
    """
    df, tt = create_dummy_medical_codes_data(3)
    df = pd.concat([df, df], ignore_index=True)
    df["vals"] = range(df.shape[0])
    df["inpatient"] = [flagvalue] * df.shape[0]
    sdf = spark.createDataFrame(df)
    sdf_patids = sdf.select("patid").distinct()
    if verbose:
        sdf.show(sdf.count())
    return sdf, sdf_patids


def get_3code_sdf_quadrupled_vertically_with_twoflagsallcombinations(
    spark, verbose=False
):
    """
    +-----+----+----+-----+-----+
    |patid|code|vals|flag1|flag2|
    +-----+----+----+-----+-----+
    |   P1|  c1|   0|    0|    0|
    |   P1|  c2|   1|    0|    0|
    |   P1|  c3|   2|    0|    0|
    |   P2|  c1|   3|    0|    0|
    |   P2|  c2|   4|    0|    0|
    |   P3|  c1|   5|    0|    0|
    |   P3|  c3|   6|    0|    0|
    |   P4|  c1|   7|    0|    0|
    |   P5|  c2|   8|    0|    0|
    |   P5|  c3|   9|    0|    0|
    |   P6|  c2|  10|    0|    0|
    |   P7|  c3|  11|    0|    0|
    |   P1|  c1|  12|    0|    1|
    |   P1|  c2|  13|    0|    1|
    |   P1|  c3|  14|    0|    1|
    |   P2|  c1|  15|    0|    1|
    |   P2|  c2|  16|    0|    1|
    |   P3|  c1|  17|    0|    1|
    |   P3|  c3|  18|    0|    1|
    |   P4|  c1|  19|    0|    1|
    |   P5|  c2|  20|    0|    1|
    |   P5|  c3|  21|    0|    1|
    |   P6|  c2|  22|    0|    1|
    |   P7|  c3|  23|    0|    1|
    |   P1|  c1|  24|    1|    0|
    |   P1|  c2|  25|    1|    0|
    |   P1|  c3|  26|    1|    0|
    |   P2|  c1|  27|    1|    0|
    |   P2|  c2|  28|    1|    0|
    |   P3|  c1|  29|    1|    0|
    |   P3|  c3|  30|    1|    0|
    |   P4|  c1|  31|    1|    0|
    |   P5|  c2|  32|    1|    0|
    |   P5|  c3|  33|    1|    0|
    |   P6|  c2|  34|    1|    0|
    |   P7|  c3|  35|    1|    0|
    |   P1|  c1|  36|    1|    1|
    |   P1|  c2|  37|    1|    1|
    |   P1|  c3|  38|    1|    1|
    |   P2|  c1|  39|    1|    1|
    |   P2|  c2|  40|    1|    1|
    |   P3|  c1|  41|    1|    1|
    |   P3|  c3|  42|    1|    1|
    |   P4|  c1|  43|    1|    1|
    |   P5|  c2|  44|    1|    1|
    |   P5|  c3|  45|    1|    1|
    |   P6|  c2|  46|    1|    1|
    |   P7|  c3|  47|    1|    1|
    +-----+----+----+-----+-----+
    """
    df, tt = create_dummy_medical_codes_data(3)
    n = df.shape[0]
    df = pd.concat([df] * 4, ignore_index=True)
    df["vals"] = range(df.shape[0])
    df["flag1"] = [0] * n * 2 + [
        1
    ] * n * 2  # all of first set are not inpatient, are of second are
    df["flag2"] = (
        [0] * n + [1] * n + [0] * n + [1] * n
    )  # all of first set are not inpatient, are of second are
    sdf = spark.createDataFrame(df)
    sdf_patids = sdf.select("patid").distinct()
    if verbose:
        sdf.show(sdf.count())
    return sdf, sdf_patids


def get_dates_for_7_patients_p1t3_post_index_date_p4t7_prior():
    """
    create a dataframe with 7 rows
      patid index_date anchor_date
    0    P1 2000-01-01  2000-01-31
    1    P2 2000-01-01  2000-03-01
    2    P3 2000-01-01  2000-03-31
    3    P4 2000-01-01  1999-12-02
    4    P5 2000-01-01  1999-11-02
    5    P6 2000-01-01  1999-10-03
    6    P7 2000-01-01  1999-09-03
    """
    df = pd.DataFrame()
    df["patid"] = [f"P{i+1}" for i in range(7)]
    index_date = datetime.datetime.strptime(f"2000-01-01", "%Y-%m-%d")
    df["index_date"] = [index_date] * 7
    anchor_dates = []
    for i in range(3):
        anchor_dates.append(index_date + datetime.timedelta(days=(i + 1) * 30))
    for i in range(4):
        anchor_dates.append(index_date - datetime.timedelta(days=(i + 1) * 30))
    df["anchor_date"] = anchor_dates
    return df


def get_3code_sdf_patids_with_p1t3_post_index_date_p4t7_prior(spark, verbose=False):
    """
    +-----+----+-------------------+-------------------+
    |patid|code|         index_date|        anchor_date|
    +-----+----+-------------------+-------------------+
    |   P1|  c1|2000-01-01 00:00:00|2000-01-31 00:00:00|
    |   P1|  c2|2000-01-01 00:00:00|2000-01-31 00:00:00|
    |   P1|  c3|2000-01-01 00:00:00|2000-01-31 00:00:00|
    |   P2|  c1|2000-01-01 00:00:00|2000-03-01 00:00:00|
    |   P2|  c2|2000-01-01 00:00:00|2000-03-01 00:00:00|
    |   P3|  c1|2000-01-01 00:00:00|2000-03-31 00:00:00|
    |   P3|  c3|2000-01-01 00:00:00|2000-03-31 00:00:00|
    |   P4|  c1|2000-01-01 00:00:00|1999-12-02 00:00:00|
    |   P5|  c2|2000-01-01 00:00:00|1999-11-02 00:00:00|
    |   P5|  c3|2000-01-01 00:00:00|1999-11-02 00:00:00|
    |   P6|  c2|2000-01-01 00:00:00|1999-10-03 00:00:00|
    |   P7|  c3|2000-01-01 00:00:00|1999-09-03 00:00:00|
    +-----+----+-------------------+-------------------+
    """
    df, tt = create_dummy_medical_codes_data(3)
    df_dates = get_dates_for_7_patients_p1t3_post_index_date_p4t7_prior()
    df = df.merge(df_dates, on="patid")
    sdf = spark.createDataFrame(df)
    sdf_patids = sdf.select("patid").distinct()
    if verbose:
        sdf.show(sdf.count())
    return sdf, sdf_patids


if __name__ == "__main__":
    generate_input_simplephenotype()
