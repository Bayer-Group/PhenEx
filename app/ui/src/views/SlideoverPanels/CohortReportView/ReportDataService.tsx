export class ReportDataService {
  private static instance: ReportDataService;
  private df_report: any;
  public columns: string[];
  public row_data: any[];
  private cohortDataService: any;
  private current_data_key: string = 'waterfall';

  public constructor() {
    this.columns = [];
    this.row_data = [];
  }

  public setCurrentDataKey(key: string) {
    this.current_data_key = key;
    this.updateReportData();
    console.log("UPDATING CURRENT DATA", key, this.cohortDataService?.cohort_data, this.columns)
  }

  private updateReportData() {
    if (this.cohortDataService?.cohort_data?.[this.current_data_key]) {
      const { columns, data } = this.cohortDataService.cohort_data[this.current_data_key];

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
