export class ReportDataService {
  private static instance: ReportDataService;
  private df_report: any;
  public columns: string[];
  public row_data: any[];

  private constructor() {
    this.columns = [
      { field: 'phenotype', headerName: 'Phenotype', sortable: true, filter: true, width: 120 },
      { field: 'N', headerName: 'N', sortable: true, filter: true, width: 100 },
      { field: '%', headerName: '%', sortable: true, filter: true, width: 100 }
    ];
    this.row_data = [
      { phenotype: "age", N: 1200, "%": "65.2%" },
      { phenotype: "race", N: 800, "%": "43.5%" },
      { phenotype: "gender", N: 920, "%": "50.0%" }
    ];
    console.log("Report row data:", this.row_data);
  }

  public static getInstance(): ReportDataService {
    if (!ReportDataService.instance) {
      ReportDataService.instance = new ReportDataService();
    }
    return ReportDataService.instance;
  }

}