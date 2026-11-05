import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createFormTracker} from '../src/pwa-forms.js';

function fixture(){
 const {document}=parseHTML('<form><input name="label" value="original"><input type="password" name="password"><input type="hidden" name="token" value="token"><input name="readonly" readonly value="fixed"><select name="level"><option value="easy">Easy</option><option value="hard">Hard</option></select></form>');
 const form=document.querySelector('form'),label=form.querySelector('[name=label]'),tracker=createFormTracker();tracker.remember(form);return {form,label,tracker};
}
test('PWA keeps an edited, unfocused form dirty and recognizes restored original values',()=>{
 const {form,label,tracker}=fixture();assert.equal(tracker.isDirty(form),false);label.value='unsaved';tracker.changed(form);assert.equal(tracker.isDirty(form),true);
 form.querySelector('[name=token]').value='rotated';form.querySelector('[readonly]').value='canonical';label.value='original';assert.equal(tracker.isDirty(form),false);
});
test('PWA accepts the initial JavaScript-selected defaults and cleans a successful saved form',()=>{
 const {form,label}=fixture(),tracker=createFormTracker();form.querySelector('option[value=hard]').selected=true;tracker.remember(form);assert.equal(tracker.isDirty(form),false);
 label.value='saved';tracker.changed(form);const submission=tracker.capture(form);tracker.saved(form,submission);assert.equal(tracker.isDirty(form),false);label.value='next edit';tracker.changed(form);assert.equal(tracker.isDirty(form),true);
});
test('PWA recognizes a server-success reset without treating cleared passwords as new edits',()=>{
 const {form,tracker}=fixture(),password=form.querySelector('[name=password]');password.value='submitted password';tracker.changed(form);const submission=tracker.capture(form);
 password.value='';tracker.saved(form,submission);assert.equal(tracker.isDirty(form),false);
});
test('PWA preserves edits made during an acknowledged save, even when they restore the old value',()=>{
 const {form,label,tracker}=fixture();label.value='submitted';tracker.changed(form);const submission=tracker.capture(form);
 label.value='original';tracker.changed(form);tracker.saved(form,submission);assert.equal(tracker.isDirty(form),true);
 label.value='submitted';assert.equal(tracker.isDirty(form),false);
});
test('PWA never clears unsaved changes just because a failed submission was captured',()=>{
 const {form,label,tracker}=fixture();label.value='not saved';tracker.changed(form);tracker.capture(form);assert.equal(tracker.isDirty(form),true);
});
