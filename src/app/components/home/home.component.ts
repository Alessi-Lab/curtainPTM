import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ToastService} from "../../toast.service";
import {DataFrame, fromCSV, IDataFrame, ISeries, Series} from "data-forge";
import {DataService} from "../../data.service";
import {UniprotService} from "../../uniprot.service";
import {selectionData} from "../protein-selections/protein-selections.component";
import {WebService} from "../../web.service";
import {PtmService} from "../../ptm.service";
import {ActivatedRoute} from "@angular/router";
import {Differential} from "../../classes/differential";
import {Raw} from "../../classes/raw";
import {InputFile} from "../../classes/input-file";
import {SettingsService} from "../../settings.service";
import {Project} from "../../classes/project";
import {LoginModalComponent} from "../../accounts/login-modal/login-modal.component";
import {NgbModal} from "@ng-bootstrap/ng-bootstrap";
import {AccountsService} from "../../accounts/accounts.service";
import {WebsocketService} from "../../websocket.service";
import {reviver} from "curtain-web-api";
import {PtmDiseasesService} from "../../ptm-diseases.service";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  GDPR: boolean = false
  finished: boolean = false
  rawFiltered: IDataFrame = new DataFrame()
  differentialFiltered:  ISeries<number, IDataFrame<number, any>> = new Series()
  uniqueLink: string = ""
  filterModel: string = ""
  currentID: string = ""
  @Output() currentIDChanged: EventEmitter<string> = new EventEmitter<string>()
  constructor(private ptmd: PtmDiseasesService, private ws: WebsocketService, private accounts: AccountsService, private modal: NgbModal, public settings: SettingsService, private data: DataService, private route: ActivatedRoute, private toast: ToastService, private uniprot: UniprotService, private web: WebService, private ptm: PtmService) {


    // if (location.protocol === "https:" && location.hostname === "curtainptm.proteo.info") {
    //   this.toast.show("Initialization", "Error: The webpage requires the url protocol to be http instead of https")
    // }
    if (localStorage.getItem("GDPR") === "true") {
      this.GDPR = false
    } else {
      this.GDPR = true
    }
    this.initialize().then(() => {
      this.ptmd.parsePTMDiseases()
      this.ptm.getDatabase("PSP_PHOSPHO")
      this.ptm.getDatabase("PLMD_UBI")
      this.ptm.getDatabase("CDB_CARBONYL")
      this.data.dataClear.asObservable().subscribe(data => {
        if (data) {
          this.rawFiltered = new DataFrame()
          this.differentialFiltered = new Series()
        }
      })
      this.data.loadDataTrigger.asObservable().subscribe(data => {
        if (data) {
          this.rawFiltered = new DataFrame()
          this.differentialFiltered = new Series()
          this.handleFinish(true)
          this.data.redrawTrigger.next(true)
          this.data.selectionUpdateTrigger.next(true)
        }
      })
      this.route.params.subscribe(params => {
        console.log(params)
        if (params) {
          if (params["settings"] && params["settings"].length > 0) {
            const settings = params["settings"].split("&")
            let token: string = ""
            if (settings.length > 1) {
              if (settings[1] !== "") {
                token = settings[1]
                this.data.tempLink = true
              } else {
                this.data.tempLink = false
              }

              if (settings.length > 2 && settings[2] !== "") {
                //this.ws.close()
                this.ws.sessionID = settings[2]
                //this.ws.reconnect()
              }
            }
            this.toast.show("Initialization", "Fetching data from session " + params["settings"]).then()
            if (this.currentID !== settings[0]) {
              this.currentID = settings[0]
              this.accounts.curtainAPI.getSessionSettings(settings[0]).then((d:any)=> {
                this.data.session = d.data
                this.accounts.curtainAPI.postSettings(settings[0], token, this.onDownloadProgress).then((data:any) => {
                  const curtainSettings = data.data
                  if (curtainSettings) {
                    this.uniqueLink = location.origin + "/#/" + this.currentID
                    this.uniprot.uniprotProgressBar.next({value: 100, text: "Restoring Session..."})
                    this.restoreSettings(curtainSettings).then(result => {
                      this.accounts.curtainAPI.getOwnership(settings[0]).then((d:any) => {
                        if (d.data.ownership) {
                          this.accounts.isOwner = true
                        } else {
                          this.accounts.isOwner = false
                        }
                      }).catch(error => {
                        this.accounts.isOwner = false
                      })
                      this.accounts.curtainAPI.getSessionSettings(settings[0]).then((d:any)=> {
                        this.data.session = d.data
                        this.settings.settings.currentID = d.data.link_id
                      })
                    })
                  }
                }).catch(error => {
                  if (error.status === 400) {
                    this.toast.show("Credential Error", "Login Information Required").then()
                    const login = this.openLoginModal()
                    login.componentInstance.loginStatus.asObservable().subscribe((data:boolean) => {
                      if (data) {
                        location.reload()
                      }
                    })
                  }
                })
              })
            }
          }
        }
      })
    })



  }

  async initialize() {
    await this.accounts.curtainAPI.getSiteProperties()
    await this.accounts.curtainAPI.user.loadFromDB()
  }

  openLoginModal() {
    const ref = this.modal.open(LoginModalComponent)
    return ref
  }
  async restoreSettings(object: any) {
    if (typeof object.settings === "string") {
      object.settings = JSON.parse(object.settings, reviver)
    }

    if (object.fetchUniProt) {
      if (object.extraData) {
        if (typeof object.extraData === "string") {
          object.extraData = JSON.parse(object.extraData, reviver)
        }
        if (object.extraData.uniprot) {
          this.uniprot.results = new Map(object.extraData.uniprot.results.value)
          this.uniprot.dataMap = new Map(object.extraData.uniprot.dataMap.value)
          this.uniprot.db = new Map(object.extraData.uniprot.db.value)
          this.uniprot.organism = object.extraData.uniprot.organism
          this.uniprot.accMap = new Map(object.extraData.uniprot.accMap.value)
          this.uniprot.geneNameToPrimary = object.extraData.uniprot.geneNameToPrimary
        }
        if (object.extraData.data) {
          this.data.accessionToPrimaryIDs = object.extraData.data.accessionToPrimaryIDs
          this.data.primaryIDsList = object.extraData.data.primaryIDsList
          this.data.accessionList = object.extraData.data.accessionList
          this.data.accessionMap = object.extraData.data.accessionMap
          this.data.genesMap = object.extraData.data.genesMap
          this.data.allGenes = object.extraData.data.allGenes
          this.data.dataMap = new Map(object.extraData.data.dataMap.value)
        }
        this.data.bypassUniProt = true
      }
    }

    if (/\t/.test(object.raw)) {
      // @ts-ignore
      this.data.raw = new InputFile(fromCSV(object.raw, {delimiter: "\t"}), "rawFile.txt", object.raw)
    } else {
      // @ts-ignore
      this.data.raw = new InputFile(fromCSV(object.raw), "rawFile.txt", object.raw)
    }
    if (/\t/.test(object.processed)) {
      // @ts-ignore
      this.data.differential = new InputFile(fromCSV(object.processed, {delimiter: "\t"}), "processedFile.txt", object.processed)
    } else {
      this.data.differential = new InputFile(fromCSV(object.processed), "processedFile.txt", object.processed)
    }

    if (!object.settings.defaultColorList) {
      object.settings.defaultColorList = this.data.palette["pastel"].slice()
    }

    if (!object.settings.scatterPlotMarkerSize) {
      object.settings.scatterPlotMarkerSize = 10
    }
    if (!object.settings.variantCorrection) {
      object.settings.variantCorrection = {}
    }
    if (!object.settings.customSequences) {
      object.settings.customSequences = {}
    }
    if (!object.settings.volcanoPlotTitle) {
      object.settings.volcanoPlotTitle = ""
    }
    if (!object.settings.textAnnotation) {
      object.settings.textAnnotation = {}
    }
    if (!object.settings.barchartColorMap) {
      object.settings.barchartColorMap = {}
    }
    if (!object.settings.volcanoAxis) {
      object.settings.volcanoAxis = {minX: null, maxX: null, minY: null, maxY: null}
    }

    if (!object.settings.project) {
      object.settings.project = new Project()
    } else {
      const p = new Project()
      for (const key in object.settings.project) {
        if (object.settings.project.hasOwnProperty(key)) {
          // @ts-ignore
          p[key] = object.settings.project[key]
        }
      }
      object.settings.project = p
    }
    if (!object.settings.sampleOrder) {
      object.settings.sampleOrder = {}
    }
    if (!object.settings.sampleVisible) {
      object.settings.sampleVisible = {}
    }
    if (!object.settings.conditionOrder) {
      object.settings.conditionOrder = []
    }
    if (object.settings.version) {
      if (object.settings.version === 2) {

        this.data.selected = object.selections
        this.data.selectedMap = object.selectionsMap
        this.data.selectOperationNames = object.selectionsName
        this.data.differentialForm = new Differential()
        this.data.differentialForm.restore(object.differentialForm)
        this.data.rawForm = new Raw()
        this.data.rawForm.restore(object.rawForm)
        this.data.fetchUniProt = object.fetchUniProt
        if (object.annotatedData) {
          this.data.annotatedData = object.annotatedData
        }
        if (object.annotatedMap) {
          this.data.annotatedMap = object.annotatedMap
        }
        if (object.dbIDMap) {
          this.data.dbIDMap = object.dbIDMap
        }
      }
    } else {
      console.log(object)
      if (object.selections) {
        this.data.differentialForm.accession = object.cols.accessionCol
        this.data.differentialForm.comparison = object.cols.comparisonCol
        this.data.differentialForm.foldChange = object.cols.foldChangeCol
        this.data.differentialForm.transformFC = object.cols.log2transform
        this.data.differentialForm.transformSignificant = object.cols.log10transform
        this.data.differentialForm.peptideSequence = object.cols.peptideSequenceCol
        this.data.differentialForm.position = object.cols.positionCol
        this.data.differentialForm.positionPeptide = object.cols.positionPeptideCol
        this.data.differentialForm.primaryIDs = object.cols.primaryIDComparisonCol
        this.data.rawForm.primaryIDs = object.cols.primaryIDRawCol
        this.data.rawForm.samples = object.cols.rawValueCols
        this.data.differentialForm.score = object.cols.score
        this.data.differentialForm.sequence = object.cols.sequenceCol
        this.data.differentialForm.significant = object.cols.significantCol
        const selections = Object.keys(object.highlights)
        const df = this.data.differential.df.where(r => selections.includes(r[this.data.differentialForm.primaryIDs])).bake()
        for (const r of df) {
          this.data.selected.push(r[this.data.differentialForm.primaryIDs])
          if (!this.data.selectOperationNames.includes(r[this.data.differentialForm.accession])) {
            this.data.selectOperationNames.push(r[this.data.differentialForm.accession])
          }
          if (!this.data.selectedMap[r[this.data.differentialForm.primaryIDs]]) {
            this.data.selectedMap[r[this.data.differentialForm.primaryIDs]] = {}
          }
          this.data.selectedMap[r[this.data.differentialForm.primaryIDs]][r[this.data.differentialForm.accession]] = true
        }
      }
    }
    for (const i in object.settings) {
      if (i !== "currentID") {
        // @ts-ignore
        this.settings.settings[i] = object.settings[i]
      }
    }

    for (const i in this.settings.settings.customPTMData) {
      if (this.ptm.databases.filter(r => r.name === i).length === 0) {
        this.ptm.databases.push({name: i, value: i, academic: true, custom: true})
        this.ptm.databaseNameMap[i] = i
      }
    }
    this.data.restoreTrigger.next(true)
  }

  ngOnInit(): void {
  }

  handleFinish(e: boolean) {
    this.finished = e
    if (this.finished) {
      if (this.data.selected.length > 0) {
        this.data.finishedProcessingData.next(e)
        this.updateSelections().then(() => {
          const differential = this.data.currentDF.where(r => this.data.selectedAccessions.includes(r[this.data.differentialForm.accession])).bake()
          this.differentialFiltered = differential.groupBy(r => r[this.data.differentialForm.accession]).bake()
        });
      } else {
        this.differentialFiltered = new Series()
      }
    }
  }

  private async updateSelections() {
    const differentialFiltered = this.data.currentDF.where(r => this.data.selected.includes(r[this.data.differentialForm.primaryIDs])).bake()
    for (const s of differentialFiltered) {
      await this.addGeneToSelected(s);
    }
    for (const s of this.rawFiltered) {
      await this.addGeneToSelected(s);
    }
  }

  private async addGeneToSelected(s: any) {
    if (!this.data.selectedAccessions.includes(s[this.data.differentialForm.accession])) {
      this.data.selectedAccessions.push(s[this.data.differentialForm.accession])
      const uni: any = this.uniprot.getUniprotFromAcc(s[this.data.differentialForm.accession])
      if (uni) {
        if (uni["Gene Names"] !== "") {
          if (!this.data.selectedGenes.includes(uni["Gene Names"])) {
            this.data.selectedGenes.push(uni["Gene Names"])
          }
        }
      }
    }
  }

  handleSearch(e: selectionData) {
    this.data.selected = this.data.selected.concat(e.data)
    if (!this.data.selectOperationNames.includes(e.title)) {
      this.data.selectOperationNames.push(e.title)
    }
    const differentialFiltered = this.data.currentDF.where(r => e.data.includes(r[this.data.differentialForm.primaryIDs])).bake()
    this.updateSearchDifferential(differentialFiltered, e).then(() => {
      const differential = this.data.currentDF.where(r => this.data.selectedAccessions.includes(r[this.data.differentialForm.accession])).bake()
      const groups = differential.groupBy(r => r[this.data.differentialForm.accession]).bake()
      this.differentialFiltered = groups
      this.data.selectionUpdateTrigger.next(true)
    });
  }

  private async updateSearchDifferential(differentialFiltered: IDataFrame<number, any>, e: selectionData) {
    for (const s of differentialFiltered) {
      if (!this.data.selectedMap[s[this.data.differentialForm.primaryIDs]]) {
        this.data.selectedMap[s[this.data.differentialForm.primaryIDs]] = {}
      }
      await this.addGeneToSelected(s);
      this.data.selectedMap[s[this.data.differentialForm.primaryIDs]][e.title] = true
    }
  }

  onDownloadProgress = (progressEvent: any) => {
    if (progressEvent.progress) {
      this.uniprot.uniprotProgressBar.next({value: progressEvent.progress *100, text: "Downloading session data at " + Math.round(progressEvent.progress * 100) + "%"})

    } else {
      const sizeDownloaded = (progressEvent.loaded / (1024*1024)).toFixed(2)
      this.uniprot.uniprotProgressBar.next({value: 100, text: "Downloading session data at " + sizeDownloaded + " MB"})
    }
  }

  closeGDPR() {
    this.GDPR = false
    localStorage.setItem("GDPR", "true")
  }
}
