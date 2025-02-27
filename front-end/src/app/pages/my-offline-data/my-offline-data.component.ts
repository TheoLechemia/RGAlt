import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Platform } from '@angular/cdk/platform';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { DownloadDialog } from './dialogs/download-dialog';
import { DeleteDialog } from './dialogs/delete-dialog';

import { OfflineService } from '../../services/offline.service';
import { LoaderDialog } from './dialogs/loader-dialog';
import { SettingsService } from '../../services/settings.service';
import { environment } from '../../../environments/environment';
import { Area } from '../../types/types';

@Component({
  selector: 'app-my-offline-data',
  standalone: true,
  imports: [
    CommonModule,
    MatGridListModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './my-offline-data.component.html',
  styleUrl: './my-offline-data.component.scss',
})
export class MyOfflineDataComponent {
  readonly dialog = inject(MatDialog);
  offlineService = inject(OfflineService);
  settingsService = inject(SettingsService);

  areas: any[] = [];

  columns: number = 2;
  breakpoints = {
    xl: 4,
    lg: 4,
    md: 2,
    sm: 2,
    xs: 1,
  };
  mobile?: boolean;

  breakpointObserver = inject(BreakpointObserver);
  platform = inject(Platform);

  ngOnInit() {
    this.mobile = this.platform.ANDROID || this.platform.IOS;

    this.breakpointObserver
      .observe([
        Breakpoints.XSmall,
        Breakpoints.Small,
        Breakpoints.Medium,
        Breakpoints.Large,
        Breakpoints.XLarge,
      ])
      .subscribe((breakpointState) => {
        if (breakpointState.matches) {
          if (breakpointState.breakpoints[Breakpoints.XSmall]) {
            this.columns = this.breakpoints.xs;
          } else if (breakpointState.breakpoints[Breakpoints.Small]) {
            this.columns = this.breakpoints.sm;
          } else if (breakpointState.breakpoints[Breakpoints.Medium]) {
            this.columns = this.breakpoints.md;
          } else if (breakpointState.breakpoints[Breakpoints.Large]) {
            this.columns = this.breakpoints.lg;
          } else if (breakpointState.breakpoints[Breakpoints.XLarge]) {
            this.columns = this.breakpoints.xl;
          }
        }
      });

    this.initAreas();
  }

  async initAreas() {
    for (
      let index = 0;
      index < this.settingsService.settings.value!.areas.length;
      index++
    ) {
      const area = this.settingsService.settings.value!.areas[index];
      this.areas.push({
        ...area,
        offline: Boolean(
          await this.offlineService.getDataInStore('offline-areas', area.id),
        ),
      });
    }
  }

  areaClick(area: any) {
    if (area.offline) {
      this.openDeleteDialog(area);
    } else {
      this.openDownloadDialog(area);
    }
  }

  openDownloadDialog(area: Area) {
    const downloadDialogRef = this.dialog.open(DownloadDialog, {
      width: '250px',
      data: { name: area.name },
    });

    downloadDialogRef.afterClosed().subscribe(async (result) => {
      if (result && result.downloaded) {
        const loaderDialogRef = this.dialog.open(LoaderDialog, {
          width: '250px',
          data: { title: 'Téléchargement en cours' },
          disableClose: true,
        });
        const { tileLayerOffline } = await import('leaflet.offline');
        const L = await import('leaflet');
        const defaultLayer = this.settingsService.settings.value?.base_maps
          .main_map.url
          ? this.settingsService.settings.value?.base_maps.main_map.url
          : environment.baseMaps.mainMap.url;
        const defaultAttribution = this.settingsService.settings.value
          ?.base_maps.main_map.attribution
          ? this.settingsService.settings.value?.base_maps.main_map.attribution
          : environment.baseMaps.mainMap.attribution;
        const minZoom = area.min_zoom;
        const maxZoom = area.max_zoom;

        const bounds = L.default.latLngBounds([
          { lat: area.bbox[0][0], lng: area.bbox[0][1] },
          { lat: area.bbox[1][0], lng: area.bbox[1][1] },
        ]);

        const offlineLayer = tileLayerOffline(defaultLayer, {
          attribution: defaultAttribution,
        });
        await this.offlineService.writeOrUpdateTilesInStore(
          offlineLayer,
          bounds,
          minZoom,
          maxZoom,
        );

        await this.offlineService.writeOrUpdateDataInStore('offline-areas', [
          area,
        ]);

        area.offline = !area.offline;
        loaderDialogRef.close();
      }
    });
  }

  openDeleteDialog(area: any) {
    const deleteDialogRef = this.dialog.open(DeleteDialog, {
      width: '250px',
      data: { name: area.name },
    });

    deleteDialogRef.afterClosed().subscribe(async (result) => {
      if (result && result.deleted) {
        const loaderDialogRef = this.dialog.open(LoaderDialog, {
          width: '250px',
          data: { title: 'Suppression en  cours' },
        });
        const { tileLayerOffline } = await import('leaflet.offline');
        const L = await import('leaflet');
        const url =
          'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
        const attribution = "<a target='_blank' href='https://ign.fr/'>IGN</a>";
        const minZoom = 0;
        const maxZoom = 9;

        const bounds = L.default.latLngBounds([
          { lat: area.bbox[0][0], lng: area.bbox[0][1] },
          { lat: area.bbox[1][0], lng: area.bbox[1][1] },
        ]);
        const offlineLayer = tileLayerOffline(url, { attribution });
        await this.offlineService.removeTilesInStore(
          offlineLayer,
          bounds,
          minZoom,
          maxZoom,
        );
        await this.offlineService.deleteDataInStore('offline-areas', [area.id]);
        area.offline = !area.offline;
        loaderDialogRef.close();
      }
    });
  }
}
