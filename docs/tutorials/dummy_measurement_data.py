
import ibis
import datetime
import pandas as pd
from phenex.mappers import *

def create_ex1_dummy_measurement_mapped_tables():
    con = ibis.duckdb.connect()

    df_measurement = pd.DataFrame()


    index_date = datetime.date(2020, 1, 1)
    one_day = datetime.timedelta(days=1)
    
    df_measurement["VALUE_AS_NUMBER"] = [
        120, #single_preindex_norm_SBP'
        120, #single_postindex_norm_SBP'
        160, #single_preindex_path_SBP'
        160, #single_postindex_path_SBP'
        80   #single_preindex_noSBP
    ]
    
    df_measurement["MEASUREMENT_TYPE_CONCEPT_ID"] = [
        'SBP',
        'SBP',
        'SBP',
        'SBP',
        'DBP'
    ]
    
    df_measurement["MEASUREMENT_DATE"] = [
        index_date-30*one_day,
        index_date+30*one_day,
        index_date-30*one_day,
        index_date+30*one_day,
        index_date-30*one_day,
    ]

    df_measurement['PERSON_ID'] = [f"P{x}" for x in range(df_measurement.shape[0])]

    df_measurement["INDEX_DATE"] = index_date
    df_measurement["UNIT"] = 'mmHg'
    df_measurement.iloc[0,-1] = "Hg"

    # create dummy observation period table
    df_measurement = df_measurement[["PERSON_ID", "MEASUREMENT_TYPE_CONCEPT_ID","VALUE_AS_NUMBER","UNIT", "MEASUREMENT_DATE", "INDEX_DATE"]]
   
    schema_measurement = {
        "PERSON_ID": str,
        "MEASUREMENT_TYPE_CONCEPT_ID":str,
        "VALUE_AS_NUMBER":int,
        "UNIT":str,
        "MEASUREMENT_DATE": datetime.date,
        "INDEX_DATE": datetime.date,
    }
    measurement_table = OMOPMeasurementTable(
        con.create_table(
            "MEASUREMENT", df_measurement, schema=schema_measurement
        )
    )

    return {
        "MEASUREMENT": measurement_table,

    }


def create_ex2_dummy_measurement_mapped_tables():
    con = ibis.duckdb.connect()

    df_measurement = pd.DataFrame()


    index_date = datetime.date(2020, 1, 1)
    one_day = datetime.timedelta(days=1)
    
    df_measurement["VALUE_AS_NUMBER"] = [
        115, 120, 190, #single_preindex_norm_SBP'
        115, 120, 190, #single_postindex_norm_SBP'
    ]
    
    df_measurement["MEASUREMENT_TYPE_CONCEPT_ID"] = [
        'SBP','SBP','SBP',
        'SBP','SBP','SBP',
    ]
    
    df_measurement["MEASUREMENT_DATE"] = [
        index_date-30*one_day,index_date-30*one_day,index_date-30*one_day,
        index_date-29*one_day,index_date-30*one_day,index_date-31*one_day,
    ]

    df_measurement['PERSON_ID'] = ['P5']*3 + ['P6']*3

    df_measurement["INDEX_DATE"] = index_date
    df_measurement["UNIT"] = 'mmHg'

    # create dummy observation period table
    df_measurement = df_measurement[["PERSON_ID", "MEASUREMENT_TYPE_CONCEPT_ID","VALUE_AS_NUMBER","UNIT", "MEASUREMENT_DATE", "INDEX_DATE"]]
   
    schema_measurement = {
        "PERSON_ID": str,
        "MEASUREMENT_TYPE_CONCEPT_ID":str,
        "VALUE_AS_NUMBER":int,
        "UNIT":str,
        "MEASUREMENT_DATE": datetime.date,
        "INDEX_DATE": datetime.date,
    }
    measurement_table = OMOPMeasurementTable(
        con.create_table(
            "MEASUREMENT", df_measurement, schema=schema_measurement
        )
    )

    return {
        "MEASUREMENT": measurement_table,

    }