import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import * as PlotlyJS from 'plotly.js-dist-min';
import { PlotlyModule } from 'angular-plotly.js';
import {HttpClient, HttpClientModule} from "@angular/common/http";
import { HeatmapComponent } from './components/heatmap/heatmap.component';
import { HomeComponent } from './components/home/home.component';
import { FileUploaderComponent } from './components/file-uploader/file-uploader.component';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import { QuickSearchComponent } from './components/quick-search/quick-search.component';
import { VolcanoPlotComponent } from './components/volcano-plot/volcano-plot.component';
import { ProteinViewerComponent } from './components/protein-viewer/protein-viewer.component';
import { BarChartComponent } from './components/bar-chart/bar-chart.component';
import { VolcanoColorGroupsComponent } from './components/volcano-color-groups/volcano-color-groups.component';
import {ColorPickerModule} from "ngx-color-picker";
import { ProteinExtraDataComponent } from './components/protein-extra-data/protein-extra-data.component';
import {ProteinDomainComponent} from "./components/protein-domain/protein-domain.component";
import {AppRoutingModule} from "./app-routing.module";

PlotlyModule.plotlyjs = PlotlyJS;
@NgModule({
  declarations: [
    AppComponent,
    HeatmapComponent,
    HomeComponent,
    FileUploaderComponent,
    QuickSearchComponent,
    VolcanoPlotComponent,
    ProteinViewerComponent,
    BarChartComponent,
    VolcanoColorGroupsComponent,
    ProteinExtraDataComponent,
    ProteinDomainComponent
  ],
    imports: [
        BrowserModule,
        NgbModule,
        PlotlyModule,
        HttpClientModule,
        FormsModule,
        ReactiveFormsModule,
        ColorPickerModule,
        AppRoutingModule
    ],
  providers: [HttpClient],
  bootstrap: [AppComponent]
})
export class AppModule { }
