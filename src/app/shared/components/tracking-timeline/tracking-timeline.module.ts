import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrackingTimelineComponent } from './tracking-timeline.component';
import { TrackingTimelineWrapperComponent } from './tracking-timeline-wrapper.component';

@NgModule({
  imports: [CommonModule, TrackingTimelineComponent, TrackingTimelineWrapperComponent],
  exports: [TrackingTimelineComponent, TrackingTimelineWrapperComponent]
})
export class TrackingTimelineModule {}
