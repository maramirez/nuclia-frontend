import { ExtraOptions, Routes } from '@angular/router';
import {
  BaseComponent,
  DashboardLayoutComponent,
  EmptyComponent,
  PageNotFoundComponent,
  RootGuard,
  SelectAccountComponent,
  SelectKbComponent,
} from '@flaps/common';
import { HomePageComponent } from './home/home-page.component';
import { MainContainerComponent } from './home/main-container/main-container.component';

export const routerOptions: ExtraOptions = {
  onSameUrlNavigation: 'reload',
  scrollPositionRestoration: 'enabled',
};

export const routes: Routes = [
  {
    path: '',
    component: BaseComponent,
    children: [
      {
        path: '',
        component: EmptyComponent,
        canActivate: [RootGuard],
      },
      {
        path: `at/:account`,
        component: DashboardLayoutComponent,
        children: [
          {
            path: `:stash`,
            component: MainContainerComponent,
            children: [
              {
                path: '',
                component: HomePageComponent,
                resolve: {},
              },
              {
                path: 'resources',
                loadChildren: () =>
                  // eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
                  import('../../../../libs/common/src/lib/resources/resources.module').then((m) => m.ResourcesModule),
              },
              {
                path: 'label-sets',
                loadChildren: () =>
                  import('../../../../libs/common/src/lib/label/label-sets/label-sets.module').then(
                    (m) => m.LabelSetsModule,
                  ),
              },
              {
                path: 'entities',
                loadChildren: () =>
                  // eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
                  import('../../../../libs/common/src/lib/entities/entities.module').then((m) => m.EntitiesModule),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: 'select',
    component: SelectAccountComponent,
    children: [
      {
        path: ':account',
        component: SelectKbComponent,
      },
    ],
  },
  { path: '**', component: PageNotFoundComponent },
];