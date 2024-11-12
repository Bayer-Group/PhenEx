import pandas as pd
import numpy as np


def create_truth_table(nvariables):
    tt = np.zeros([int(nvariables**2) - 1, nvariables])
    for col_idx in range(tt.shape[1]):
        n = tt.shape[1] - col_idx
        n_per_group = (2**n) // 2

        for row_group in range(0, tt.shape[0] // n_per_group, 2):
            s = row_group * n_per_group
            e = s + n_per_group
            tt[s:e, col_idx] = col_idx + 1
    return tt


def create_patient_truth_table(nvariables):
    tt = create_truth_table(nvariables)
    patientids = [f"P{i+1}" for i in range(tt.shape[0])]
    _df = pd.DataFrame(tt)
    _df["patid"] = patientids
    return _df


def create_dummy_medical_codes_data(
    nvariables, code_prefix="c", code_columnname="code", patientid_columnname="patid"
):
    _df = create_patient_truth_table(nvariables)
    i = 0
    ds = []
    for r in range(_df.shape[0]):
        for c in range(_df.shape[1] - 1):
            value = _df[c].iloc[r]
            if value != 0:
                ds.append(
                    {
                        patientid_columnname: _df["patid"].iloc[r],
                        code_columnname: f"{code_prefix}{int(value)}",
                    }
                )
            i += 1
    _df_dummy = pd.DataFrame(ds)
    return _df_dummy, _df


def print_truth_table():
    print("    patid       ")
    print("    P1   c1   c2   c3")
    print("    P2   c1   c2     ")
    print("    P3   c1        c3")
    print("    P4   c1          ")
    print("    P5        c2   c3")
    print("    P6        c2     ")
    print("    P7             c3")
    print("    P8      ")
