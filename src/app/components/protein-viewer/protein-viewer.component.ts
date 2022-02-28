import {Component, Input, OnDestroy, OnInit, ViewChildren} from '@angular/core';
import {DataFrame, IDataFrame} from "data-forge";
import {DataService} from "../../../services/data.service";
import {UniprotService} from "../../../services/uniprot.service";
import {FormBuilder, FormGroup} from "@angular/forms";
import {BehaviorSubject, debounceTime, distinctUntilChanged} from "rxjs";
import {SettingsService} from "../../../services/settings.service";

@Component({
  selector: 'app-protein-viewer',
  templateUrl: './protein-viewer.component.html',
  styleUrls: ['./protein-viewer.component.css']
})
export class ProteinViewerComponent implements OnInit, OnDestroy {
  _data = ""
  selectedUID: any[] = []
  df: IDataFrame = new DataFrame()
  sequence: string = ""
  descending = false
  residueMap: any = {}
  uniprotData: any = {}
  form: FormGroup = this.fb.group({
    probability: 0
  })

  sortReverse: any = {}
  @Input() set data(value: string)  {
    this._data = value
    if (!this.dataService.observableTriggerMap[this._data] && this._data !== "") {
      this.dataService.observableTriggerMap[this._data] = new BehaviorSubject<boolean>(false)
    }
    this.processData();

  }

  private processData() {
    const d = this.uniprot.results.get(this._data)
    if (!(this.settings.settings.probabilityFilterMap[this._data])) {
      this.settings.settings.probabilityFilterMap[this._data] = 0
    }
    if (d) {
      this.residueMap = {}
      const q = this.dataService.queryMap.get(this._data)
      this.sequence = d["Sequence"]
      this.uniprotData = d
      if (q) {
        this.queries = q
        this.selectedUID = []
        for (const c in this.queries) {
          for (const s of this.queries[c]) {
            if (!this.selectedUID.includes(s)) {
              this.selectedUID.push(s)
            }
          }
        }
        this.df = this.dataService.dataFile.data.where(row => row[this.dataService.cols.accessionCol] === this._data).bake()
        this.changeDF = this.df.where(row => this.selectedUID.includes(row[this.dataService.cols.primaryIDComparisonCol])).bake()
        for (const r of this.df) {
          if (r[this.dataService.cols.score] >= (this.settings.settings.probabilityFilterMap[this._data]/100)) {
            this.residueMap[r[this.dataService.cols.positionCol]] = this.sequence[r[this.dataService.cols.positionCol] - 1]
          }
        }
      }
    }
  }

  queries: any[] = []
  changeDF: IDataFrame = new DataFrame()

  get data(): string {
    return this._data
  }
  constructor(public dataService: DataService, private uniprot: UniprotService, private fb: FormBuilder, private settings: SettingsService) {

    this.form.valueChanges.pipe(debounceTime(1000), distinctUntilChanged()).subscribe(data=> {
      this.settings.settings.probabilityFilterMap[this._data] = this.form.value["probability"]
      this.processData()
      this.dataService.observableTriggerMap[this._data].next(true)
    })
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.dataService.observableTriggerMap[this._data] = null
  }

  sortHeader(headerName: string) {
    if (!(headerName in this.sortReverse)) {
      this.sortReverse[headerName] = false
    }

    if (this.sortReverse[headerName]) {
      this.df = this.df.orderBy(row => row[headerName]).bake()
    } else {
      this.df = this.df.orderByDescending(row => row[headerName]).bake()
    }

    this.sortReverse[headerName] = !this.sortReverse[headerName]
  }

  getResidue(position: string) {
    return this.sequence[parseInt(position)-1]
  }
}
