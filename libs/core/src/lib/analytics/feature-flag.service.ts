import { Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';

interface Features {
  [key: string]: string | boolean | undefined;
}

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private features?: Features;
  private isNotProd = location.hostname !== 'nuclia.cloud';

  isFeatureEnabled(feature: string): Observable<boolean> {
    if (this.isNotProd) {
      return of(true);
    } else {
      return this.loadFeatures().pipe(map((features) => !!features[feature]));
    }
  }

  getFeatureFlag(feature: string): Observable<string | boolean | undefined> {
    return this.loadFeatures().pipe(map((features) => features[feature]));
  }

  getEnabledFeatures(): Observable<string[]> {
    return this.loadFeatures().pipe(
      map((features) =>
        Object.entries(features)
          .filter(([, value]) => this.isNotProd || !!value)
          .map(([key]) => key),
      ),
    );
  }

  private loadFeatures(): Observable<Features> {
    if (this.features) {
      return of(this.features);
    } else {
      return new Observable<Features>((observer) => {
        fetch('https://nuclia.github.io/status/features.json')
          .then((res) => res.json())
          .then((data) => {
            this.features = data as Features;
            observer.next(this.features);
            observer.complete();
          });
      });
    }
  }
}