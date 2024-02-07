import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ReCaptchaV3Service } from 'ngx-captcha';
import { BackendConfigurationService, LoginService, RecoverData } from '@flaps/core';
import { TranslateService } from '@ngx-translate/core';
import { SisModalService } from '@nuclia/sistema';
import { forkJoin, map } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'stf-recover',
  templateUrl: './recover.component.html',
  styleUrls: ['./recover.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoverComponent {
  recoverForm = new FormGroup({
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  recoverValidationMessages = {
    email: {
      required: 'validation.required',
      email: 'validation.email',
    },
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private loginService: LoginService,
    private reCaptchaV3Service: ReCaptchaV3Service,
    private config: BackendConfigurationService,
    private modalService: SisModalService,
    private translate: TranslateService,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  submit() {
    if (!this.recoverForm.valid) return;
    const recaptchaKey = this.config.getRecaptchaKey();
    if (recaptchaKey) {
      this.reCaptchaV3Service.execute(recaptchaKey, 'recover', (token) => {
        this.recover(token);
      });
    } else {
      throw new Error('Recaptcha key not found');
    }
  }

  recover(token: string) {
    const recoverInfo = new RecoverData(this.recoverForm.getRawValue().email, this.config.getAppName());
    this.loginService
      .recover(recoverInfo, token)
      .pipe(
        switchMap(() =>
          forkJoin([this.translate.get('login.check_email.email_sent'), this.translate.get('recover.verify')]),
        ),
        map((messages) => messages.join('<br>')),
        switchMap(
          (description) =>
            this.modalService.openConfirm({
              title: 'login.check_email.title',
              description,
              confirmLabel: 'Ok',
              onlyConfirm: true,
            }).onClose,
        ),
      )
      .subscribe(() =>
        this.router.navigate(['../login'], {
          relativeTo: this.route,
        }),
      );
  }
}
