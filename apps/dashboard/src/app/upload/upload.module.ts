import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { FlexLayoutModule } from '@angular/flex-layout';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';
import { STFButtonsModule, STFFormDirectivesModule, STFInputModule, STFTooltipModule } from '@flaps/pastanaga';
import { STFCheckboxModule } from '@flaps/common';
import { FileUploadModule, STFPipesModule } from '@flaps/core';

import { CreateLinkComponent } from './create-link/create-link.component';
import { UploadFilesComponent } from './upload-files/upload-files.component';
import { UploadFilesDialogComponent } from './upload-files/upload-files-dialog.component';
import { UploadProgressComponent } from './upload-progress/upload-progress.component';
import { UploadProgressDialogComponent } from './upload-progress/upload-progress-dialog.component';
import { LabelModule } from '../components/label/label.module';
import { HintModule } from '../components/hint/hint.module';
import { PaButtonModule, PaIconModule, PaTogglesModule, PaTooltipModule } from '@guillotinaweb/pastanaga-angular';

const Components = [
  CreateLinkComponent,
  UploadFilesComponent,
  UploadFilesDialogComponent,
  UploadProgressComponent,
  UploadProgressDialogComponent,
];

@NgModule({
  imports: [
    CommonModule,
    AngularSvgIconModule,
    FlexLayoutModule,
    TranslateModule.forChild(),
    ReactiveFormsModule,
    RouterModule,
    MatDialogModule,
    STFButtonsModule,
    STFInputModule,
    STFFormDirectivesModule,
    STFTooltipModule,
    STFCheckboxModule,
    FileUploadModule,
    STFPipesModule,
    LabelModule,
    HintModule,
    PaButtonModule,
    PaIconModule,
    PaTogglesModule,
    PaTooltipModule,
  ],
  declarations: [...Components],
  exports: [],
})
export class UploadModule {}