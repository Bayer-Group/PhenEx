export class ReportDataService {
  private static instance: ReportDataService;
  private df_report: any;
  public columns: string[];
  public row_data: any[];
  private cohortDataService: any;

  public constructor() {
    this.columns = [
      { field: 'phenotype', headerName: 'Phenotype', sortable: true, filter: true, width: 120 },
      { field: 'N', headerName: 'N', sortable: true, filter: true, width: 100 },
      { field: '%', headerName: '%', sortable: true, filter: true, width: 100 },
    ];
    this.row_data = [
      { phenotype: 'age', N: 1200, '%': '65.2%' },
      { phenotype: 'race', N: 800, '%': '43.5%' },
      { phenotype: 'gender', N: 920, '%': '50.0%' },
    ];
  }

  private updateReportData() {
    if (this.cohortDataService.cohort_data?.waterfall) {
      const { columns, data } = this.cohortDataService.cohort_data.waterfall;

      // Transform array data into dictionaries using column names as keys
      this.row_data = data.map(row => {
        const rowDict: { [key: string]: any } = {};
        columns.forEach((col: string, index: number) => {
          rowDict[col] = row[index];
        });
        return rowDict;
      });

      // Create ag-Grid column definitions
      this.columns = columns.map(column => ({
        field: column,
        headerName: column.charAt(0).toUpperCase() + column.slice(1),
        sortable: true,
        filter: true,
        width: 120,
      }));
    } else {
      this.row_data = [];
      this.columns = [];
    }
  }

  public setCohortDataService(dataService: any) {
    this.cohortDataService = dataService;
    this.cohortDataService.addListener(() => {
      this.updateReportData();
    });
  }
}
