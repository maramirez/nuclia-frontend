import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { SDKService, TranslatePipeMock } from '@flaps/core';

import { ResourceListComponent } from './resource-list.component';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MockModule } from 'ng-mocks';
import { PaButtonModule, PaTextFieldModule } from '@guillotinaweb/pastanaga-angular';
import { CdkTableModule } from '@angular/cdk/table';

describe('ResourceListComponent', () => {
  let component: ResourceListComponent;
  let fixture: ComponentFixture<ResourceListComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [CdkTableModule, MatDialogModule, MockModule(PaButtonModule), MockModule(PaTextFieldModule)],
      declarations: [ResourceListComponent, TranslatePipeMock],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: SDKService,
          useValue: {
            currentKb: of({ listResources: () => of({ resources: [] }) }),
            counters: of({ resources: 0 }),
            refreshing: of(true),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({}),
            snapshot: {
              queryParams: {},
            },
          },
        },
        {
          provide: Router,
          useValue: {},
        },
        {
          provide: TranslateService,
          useValue: { get: () => of('') },
        },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ResourceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});