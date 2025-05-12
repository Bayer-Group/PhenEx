import pandas as pd
from upsetplot import UpSet
from upsetplot import from_memberships
import matplotlib.pyplot as plt

class UpSetPlot:
    """
    A class to prepare data for an UpSet plot.
    
    Attributes:
        inclusions_table : DataFrame containing inclusion criteria data with boolean columns.
    """

    def execute(self, cohort: "Cohort") -> pd.DataFrame:
        
        """
        Execute the process to prepare data for the UpSet plot.
        """

        self.cohort = cohort
        self.inclusions_table = self.cohort.inclusions_table
        criteria_dict = {}

            
         # Get the boolean columns
        criteria_columns = [col for col in self.inclusions_table.columns if col != 'PERSON_ID']
    

        # Generate the membership dictionary
        for row in self.inclusions_table.to_pandas().itertuples(index=False):
            patient_id = row.PERSON_ID
        # Get the criteria names where the value is True
            criteria = [col for col in criteria_columns if getattr(row, col)]  # Exclude 'id' and get criteria columns
            criteria_dict[patient_id] = criteria
        
        criteria_list_of_lists= list(criteria_dict.values())

        self.prepared_data=from_memberships(criteria_list_of_lists)

        return self.prepared_data


    def plot_upset(self):
        """
        Generate the UpSet plot.
        """
        if self.prepared_data is None:
            raise ValueError("No prepared data available. Please run execute() first.")
            
        upset = UpSet(self.prepared_data, subset_size='count',  facecolor="navy", shading_color="lightgray", show_counts='%d', sort_by='cardinality')
        upset.plot()
        plt.title("UpSet Plot of Inclusion Criteria")
        plt.show()


# Create an instance of UpSetDataPrep
upset_data_prep = UpSetPlot()

# Execute the data preparation and plot the UpSet
upset_data_prep.execute(cprd_study.cohort)
upset_data_prep.plot_upset()