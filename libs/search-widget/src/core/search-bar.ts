import { distinctUntilChanged, filter, map, switchMap, take, tap } from 'rxjs/operators';
import { search } from './api';
import type { Search, SearchOptions } from '@nuclia/core';
import { Chat, ResourceProperties } from '@nuclia/core';
import { forkJoin, Subscription } from 'rxjs';
import {
  autofilerDisabled,
  isEmptySearchQuery,
  isTitleOnly,
  loadMore,
  pageNumber,
  pendingResults,
  searchFilters,
  searchOptions,
  searchQuery,
  searchResults,
  trackingResultsReceived,
  trackingSearchId,
  trackingStartTime,
  triggerSearch,
} from './stores/search.store';
import { askQuestion } from './stores/effects';
import { onlyAnswers } from './stores/widget.store';

const subscriptions: Subscription[] = [];

export function unsubscribeTriggerSearch() {
  subscriptions.forEach((subscription) => subscription.unsubscribe());
}

export const setupTriggerSearch = (
  dispatch: (event: string, details: string | Search.Results | Search.FindResults) => void | undefined,
  isAnswerEnabled = false,
): void => {
  subscriptions.push(
    triggerSearch
      .pipe(
        switchMap((trigger) =>
          isEmptySearchQuery.pipe(
            take(1),
            filter((isEmptySearchQuery) => !isEmptySearchQuery),
            switchMap(() => searchQuery.pipe(take(1))),
            tap((query) => (dispatch ? dispatch('search', query) : undefined)),
            tap((query) => {
              if (!trigger?.more) {
                pageNumber.set(0);
                trackingStartTime.set(Date.now());
              }
            }),
            switchMap((query) =>
              forkJoin([
                onlyAnswers.pipe(take(1)),
                searchOptions.pipe(take(1)),
                searchFilters.pipe(take(1)),
                isTitleOnly.pipe(take(1)),
                autofilerDisabled.pipe(take(1)),
              ]).pipe(
                tap(([onlyAnswers]) => {
                  if (!onlyAnswers) {
                    pendingResults.set(true);
                  }
                }),
                switchMap(([onlyAnswers, options, filters, inTitleOnly, autofilerDisabled]) => {
                  const show = [ResourceProperties.BASIC, ResourceProperties.VALUES, ResourceProperties.ORIGIN];
                  const currentOptions: SearchOptions = {
                    ...options,
                    show,
                    filters,
                    inTitleOnly,
                    ...(autofilerDisabled ? { autofilter: false } : {}),
                  };
                  if (isAnswerEnabled && !trigger?.more) {
                    return askQuestion(query, true, currentOptions).pipe(
                      map((res) => ({ ...res, onlyAnswers, loadingMore: trigger?.more })),
                    );
                  } else {
                    return search(query, currentOptions).pipe(
                      map((results) => ({ results, append: !!trigger?.more, onlyAnswers, loadingMore: trigger?.more })),
                    );
                  }
                }),
              ),
            ),
          ),
        ),
      )
      .subscribe((data) => {
        if (isAnswerEnabled && !data.loadingMore) {
          const { answer } = data as { question: string; answer: Chat.Answer };
          if (answer.sources && !data.onlyAnswers) {
            trackingSearchId.set(answer.sources.searchId);
            searchResults.set({ results: answer.sources, append: false });
          }
        } else {
          const { results, append } = data as { results: Search.FindResults; append: boolean };
          if (!append) {
            trackingSearchId.set(results.searchId);
          }
          searchResults.set({ results, append });
        }
        trackingResultsReceived.set(true);
      }),
  );

  if (typeof dispatch === 'function') {
    subscriptions.push(searchResults.subscribe((results) => dispatch('results', results)));
  }

  subscriptions.push(
    loadMore
      .pipe(
        filter((page) => !!page),
        distinctUntilChanged(),
      )
      .subscribe(() => {
        triggerSearch.next({ more: true });
      }),
  );
};
