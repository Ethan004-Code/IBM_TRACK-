import type { DataTag, DefinedInitialDataOptions, DefinedUseQueryResult, QueryClient, QueryKey, UndefinedInitialDataOptions, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { DecisionInput, GetListingsParams, HealthStatus, InterpretationInput, JsonResult, ListingChange, ListingDraft, ListingInput, OfferInput, OutcomeInput, PhotoUpload } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getGetServiceStatusUrl: () => string;
export declare const getServiceStatus: (options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getGetServiceStatusQueryKey: () => readonly ["/api/health"];
export declare const getGetServiceStatusQueryOptions: <TData = Awaited<ReturnType<typeof getServiceStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getServiceStatus>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getServiceStatus>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetServiceStatusQueryResult = NonNullable<Awaited<ReturnType<typeof getServiceStatus>>>;
export type GetServiceStatusQueryError = ErrorType<unknown>;
export declare function useGetServiceStatus<TData = Awaited<ReturnType<typeof getServiceStatus>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getServiceStatus>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getServiceStatus>>, TError, Awaited<ReturnType<typeof getServiceStatus>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetServiceStatus<TData = Awaited<ReturnType<typeof getServiceStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getServiceStatus>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getServiceStatus>>, TError, Awaited<ReturnType<typeof getServiceStatus>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetServiceStatus<TData = Awaited<ReturnType<typeof getServiceStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getServiceStatus>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getGetListingsUrl: (params?: GetListingsParams) => string;
export declare const getListings: (params?: GetListingsParams, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getGetListingsQueryKey: (params?: GetListingsParams) => readonly ["/api/listings", ...GetListingsParams[]];
export declare const getGetListingsQueryOptions: <TData = Awaited<ReturnType<typeof getListings>>, TError = ErrorType<unknown>>(params?: GetListingsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListings>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getListings>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetListingsQueryResult = NonNullable<Awaited<ReturnType<typeof getListings>>>;
export type GetListingsQueryError = ErrorType<unknown>;
export declare function useGetListings<TData = Awaited<ReturnType<typeof getListings>>, TError = ErrorType<unknown>>(params: undefined | GetListingsParams, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListings>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getListings>>, TError, Awaited<ReturnType<typeof getListings>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetListings<TData = Awaited<ReturnType<typeof getListings>>, TError = ErrorType<unknown>>(params?: GetListingsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListings>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getListings>>, TError, Awaited<ReturnType<typeof getListings>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetListings<TData = Awaited<ReturnType<typeof getListings>>, TError = ErrorType<unknown>>(params?: GetListingsParams, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListings>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getPublishListingUrl: () => string;
export declare const publishListing: (listingInput: ListingInput, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getPublishListingMutationKey: () => readonly ["publishListing"];
export declare const getPublishListingMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishListing>>, TError, PublishListingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof publishListing>>, TError, PublishListingMutationVariables, TContext>;
export type PublishListingMutationResult = NonNullable<Awaited<ReturnType<typeof publishListing>>>;
export type PublishListingMutationBody = BodyType<ListingInput>;
export type PublishListingMutationError = ErrorType<unknown>;
export type PublishListingMutationVariables = {
    data: BodyType<ListingInput>;
};
export declare const usePublishListing: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishListing>>, TError, PublishListingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof publishListing>>, TError, PublishListingMutationVariables, TContext>;
export declare const getUploadListingPhotoUrl: () => string;
/**
 * @summary Upload an authenticated owner's private JPG, PNG or WebP photo
 */
export declare const uploadListingPhoto: (photoUpload: PhotoUpload, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getUploadListingPhotoMutationKey: () => readonly ["uploadListingPhoto"];
export declare const getUploadListingPhotoMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadListingPhoto>>, TError, UploadListingPhotoMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof uploadListingPhoto>>, TError, UploadListingPhotoMutationVariables, TContext>;
export type UploadListingPhotoMutationResult = NonNullable<Awaited<ReturnType<typeof uploadListingPhoto>>>;
export type UploadListingPhotoMutationBody = BodyType<PhotoUpload>;
export type UploadListingPhotoMutationError = ErrorType<unknown>;
export type UploadListingPhotoMutationVariables = {
    data: BodyType<PhotoUpload>;
};
/**
* @summary Upload an authenticated owner's private JPG, PNG or WebP photo
*/
export declare const useUploadListingPhoto: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadListingPhoto>>, TError, UploadListingPhotoMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof uploadListingPhoto>>, TError, UploadListingPhotoMutationVariables, TContext>;
export declare const getGetListingPhotoUrl: (photoId: string) => string;
export declare const getListingPhoto: (photoId: string, options?: Parameters<typeof customFetch>[1]) => Promise<Blob>;
export declare const getGetListingPhotoQueryKey: (photoId: string) => readonly [`/api/listing-photos/${string}`];
export declare const getGetListingPhotoQueryOptions: <TData = Awaited<ReturnType<typeof getListingPhoto>>, TError = ErrorType<unknown>>(photoId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListingPhoto>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getListingPhoto>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetListingPhotoQueryResult = NonNullable<Awaited<ReturnType<typeof getListingPhoto>>>;
export type GetListingPhotoQueryError = ErrorType<unknown>;
export declare function useGetListingPhoto<TData = Awaited<ReturnType<typeof getListingPhoto>>, TError = ErrorType<unknown>>(photoId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListingPhoto>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getListingPhoto>>, TError, Awaited<ReturnType<typeof getListingPhoto>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetListingPhoto<TData = Awaited<ReturnType<typeof getListingPhoto>>, TError = ErrorType<unknown>>(photoId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListingPhoto>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getListingPhoto>>, TError, Awaited<ReturnType<typeof getListingPhoto>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetListingPhoto<TData = Awaited<ReturnType<typeof getListingPhoto>>, TError = ErrorType<unknown>>(photoId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListingPhoto>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getDeleteUnpostedListingPhotoUrl: (photoId: string) => string;
export declare const deleteUnpostedListingPhoto: (photoId: string, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getDeleteUnpostedListingPhotoMutationKey: () => readonly ["deleteUnpostedListingPhoto"];
export declare const getDeleteUnpostedListingPhotoMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteUnpostedListingPhoto>>, TError, DeleteUnpostedListingPhotoMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteUnpostedListingPhoto>>, TError, DeleteUnpostedListingPhotoMutationVariables, TContext>;
export type DeleteUnpostedListingPhotoMutationResult = NonNullable<Awaited<ReturnType<typeof deleteUnpostedListingPhoto>>>;
export type DeleteUnpostedListingPhotoMutationError = ErrorType<unknown>;
export type DeleteUnpostedListingPhotoMutationVariables = {
    photoId: string;
};
export declare const useDeleteUnpostedListingPhoto: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteUnpostedListingPhoto>>, TError, DeleteUnpostedListingPhotoMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof deleteUnpostedListingPhoto>>, TError, DeleteUnpostedListingPhotoMutationVariables, TContext>;
export declare const getReviewListingUrl: () => string;
/**
 * @summary Require complete fields and real Bob image approval; never publishes
 */
export declare const reviewListing: (listingDraft: ListingDraft, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getReviewListingMutationKey: () => readonly ["reviewListing"];
export declare const getReviewListingMutationOptions: <TError = ErrorType<JsonResult>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reviewListing>>, TError, ReviewListingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof reviewListing>>, TError, ReviewListingMutationVariables, TContext>;
export type ReviewListingMutationResult = NonNullable<Awaited<ReturnType<typeof reviewListing>>>;
export type ReviewListingMutationBody = BodyType<ListingDraft>;
export type ReviewListingMutationError = ErrorType<JsonResult>;
export type ReviewListingMutationVariables = {
    data: BodyType<ListingDraft>;
};
/**
* @summary Require complete fields and real Bob image approval; never publishes
*/
export declare const useReviewListing: <TError = ErrorType<JsonResult>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reviewListing>>, TError, ReviewListingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof reviewListing>>, TError, ReviewListingMutationVariables, TContext>;
export declare const getUpdateReviewedListingUrl: (id: string) => string;
export declare const updateReviewedListing: (id: string, listingChange: ListingChange, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getUpdateReviewedListingMutationKey: () => readonly ["updateReviewedListing"];
export declare const getUpdateReviewedListingMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateReviewedListing>>, TError, UpdateReviewedListingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateReviewedListing>>, TError, UpdateReviewedListingMutationVariables, TContext>;
export type UpdateReviewedListingMutationResult = NonNullable<Awaited<ReturnType<typeof updateReviewedListing>>>;
export type UpdateReviewedListingMutationBody = BodyType<ListingChange>;
export type UpdateReviewedListingMutationError = ErrorType<unknown>;
export type UpdateReviewedListingMutationVariables = {
    id: string;
    data: BodyType<ListingChange>;
};
export declare const useUpdateReviewedListing: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateReviewedListing>>, TError, UpdateReviewedListingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof updateReviewedListing>>, TError, UpdateReviewedListingMutationVariables, TContext>;
export declare const getWithdrawListingUrl: (id: string) => string;
export declare const withdrawListing: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getWithdrawListingMutationKey: () => readonly ["withdrawListing"];
export declare const getWithdrawListingMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof withdrawListing>>, TError, WithdrawListingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof withdrawListing>>, TError, WithdrawListingMutationVariables, TContext>;
export type WithdrawListingMutationResult = NonNullable<Awaited<ReturnType<typeof withdrawListing>>>;
export type WithdrawListingMutationError = ErrorType<unknown>;
export type WithdrawListingMutationVariables = {
    id: string;
};
export declare const useWithdrawListing: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof withdrawListing>>, TError, WithdrawListingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof withdrawListing>>, TError, WithdrawListingMutationVariables, TContext>;
export declare const getInterpretListingUrl: () => string;
export declare const interpretListing: (interpretationInput: InterpretationInput, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getInterpretListingMutationKey: () => readonly ["interpretListing"];
export declare const getInterpretListingMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof interpretListing>>, TError, InterpretListingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof interpretListing>>, TError, InterpretListingMutationVariables, TContext>;
export type InterpretListingMutationResult = NonNullable<Awaited<ReturnType<typeof interpretListing>>>;
export type InterpretListingMutationBody = BodyType<InterpretationInput>;
export type InterpretListingMutationError = ErrorType<unknown>;
export type InterpretListingMutationVariables = {
    data: BodyType<InterpretationInput>;
};
export declare const useInterpretListing: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof interpretListing>>, TError, InterpretListingMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof interpretListing>>, TError, InterpretListingMutationVariables, TContext>;
export declare const getGetListingMatchesUrl: (id: string) => string;
export declare const getListingMatches: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getGetListingMatchesQueryKey: (id: string) => readonly [`/api/listings/${string}/matches`];
export declare const getGetListingMatchesQueryOptions: <TData = Awaited<ReturnType<typeof getListingMatches>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListingMatches>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getListingMatches>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetListingMatchesQueryResult = NonNullable<Awaited<ReturnType<typeof getListingMatches>>>;
export type GetListingMatchesQueryError = ErrorType<unknown>;
export declare function useGetListingMatches<TData = Awaited<ReturnType<typeof getListingMatches>>, TError = ErrorType<unknown>>(id: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListingMatches>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getListingMatches>>, TError, Awaited<ReturnType<typeof getListingMatches>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetListingMatches<TData = Awaited<ReturnType<typeof getListingMatches>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListingMatches>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getListingMatches>>, TError, Awaited<ReturnType<typeof getListingMatches>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetListingMatches<TData = Awaited<ReturnType<typeof getListingMatches>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getListingMatches>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getGetFallbackOptionsUrl: (id: string) => string;
export declare const getFallbackOptions: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getGetFallbackOptionsQueryKey: (id: string) => readonly [`/api/listings/${string}/fallback-options`];
export declare const getGetFallbackOptionsQueryOptions: <TData = Awaited<ReturnType<typeof getFallbackOptions>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getFallbackOptions>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFallbackOptions>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetFallbackOptionsQueryResult = NonNullable<Awaited<ReturnType<typeof getFallbackOptions>>>;
export type GetFallbackOptionsQueryError = ErrorType<unknown>;
export declare function useGetFallbackOptions<TData = Awaited<ReturnType<typeof getFallbackOptions>>, TError = ErrorType<unknown>>(id: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getFallbackOptions>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getFallbackOptions>>, TError, Awaited<ReturnType<typeof getFallbackOptions>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetFallbackOptions<TData = Awaited<ReturnType<typeof getFallbackOptions>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getFallbackOptions>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getFallbackOptions>>, TError, Awaited<ReturnType<typeof getFallbackOptions>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetFallbackOptions<TData = Awaited<ReturnType<typeof getFallbackOptions>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getFallbackOptions>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getGetOffersUrl: () => string;
export declare const getOffers: (options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getGetOffersQueryKey: () => readonly ["/api/offers"];
export declare const getGetOffersQueryOptions: <TData = Awaited<ReturnType<typeof getOffers>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getOffers>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOffers>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetOffersQueryResult = NonNullable<Awaited<ReturnType<typeof getOffers>>>;
export type GetOffersQueryError = ErrorType<unknown>;
export declare function useGetOffers<TData = Awaited<ReturnType<typeof getOffers>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getOffers>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getOffers>>, TError, Awaited<ReturnType<typeof getOffers>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetOffers<TData = Awaited<ReturnType<typeof getOffers>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getOffers>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getOffers>>, TError, Awaited<ReturnType<typeof getOffers>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetOffers<TData = Awaited<ReturnType<typeof getOffers>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getOffers>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getProposeOfferUrl: () => string;
export declare const proposeOffer: (offerInput: OfferInput, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getProposeOfferMutationKey: () => readonly ["proposeOffer"];
export declare const getProposeOfferMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof proposeOffer>>, TError, ProposeOfferMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof proposeOffer>>, TError, ProposeOfferMutationVariables, TContext>;
export type ProposeOfferMutationResult = NonNullable<Awaited<ReturnType<typeof proposeOffer>>>;
export type ProposeOfferMutationBody = BodyType<OfferInput>;
export type ProposeOfferMutationError = ErrorType<unknown>;
export type ProposeOfferMutationVariables = {
    data: BodyType<OfferInput>;
};
export declare const useProposeOffer: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof proposeOffer>>, TError, ProposeOfferMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof proposeOffer>>, TError, ProposeOfferMutationVariables, TContext>;
export declare const getRespondToOfferUrl: (id: string) => string;
export declare const respondToOffer: (id: string, decisionInput: DecisionInput, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getRespondToOfferMutationKey: () => readonly ["respondToOffer"];
export declare const getRespondToOfferMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof respondToOffer>>, TError, RespondToOfferMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof respondToOffer>>, TError, RespondToOfferMutationVariables, TContext>;
export type RespondToOfferMutationResult = NonNullable<Awaited<ReturnType<typeof respondToOffer>>>;
export type RespondToOfferMutationBody = BodyType<DecisionInput>;
export type RespondToOfferMutationError = ErrorType<unknown>;
export type RespondToOfferMutationVariables = {
    id: string;
    data: BodyType<DecisionInput>;
};
export declare const useRespondToOffer: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof respondToOffer>>, TError, RespondToOfferMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof respondToOffer>>, TError, RespondToOfferMutationVariables, TContext>;
export declare const getConfirmPickupUrl: (id: string) => string;
export declare const confirmPickup: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getConfirmPickupMutationKey: () => readonly ["confirmPickup"];
export declare const getConfirmPickupMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof confirmPickup>>, TError, ConfirmPickupMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof confirmPickup>>, TError, ConfirmPickupMutationVariables, TContext>;
export type ConfirmPickupMutationResult = NonNullable<Awaited<ReturnType<typeof confirmPickup>>>;
export type ConfirmPickupMutationError = ErrorType<unknown>;
export type ConfirmPickupMutationVariables = {
    id: string;
};
export declare const useConfirmPickup: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof confirmPickup>>, TError, ConfirmPickupMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof confirmPickup>>, TError, ConfirmPickupMutationVariables, TContext>;
export declare const getRecordExternalOutcomeUrl: () => string;
export declare const recordExternalOutcome: (outcomeInput: OutcomeInput, options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getRecordExternalOutcomeMutationKey: () => readonly ["recordExternalOutcome"];
export declare const getRecordExternalOutcomeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof recordExternalOutcome>>, TError, RecordExternalOutcomeMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof recordExternalOutcome>>, TError, RecordExternalOutcomeMutationVariables, TContext>;
export type RecordExternalOutcomeMutationResult = NonNullable<Awaited<ReturnType<typeof recordExternalOutcome>>>;
export type RecordExternalOutcomeMutationBody = BodyType<OutcomeInput>;
export type RecordExternalOutcomeMutationError = ErrorType<unknown>;
export type RecordExternalOutcomeMutationVariables = {
    data: BodyType<OutcomeInput>;
};
export declare const useRecordExternalOutcome: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof recordExternalOutcome>>, TError, RecordExternalOutcomeMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof recordExternalOutcome>>, TError, RecordExternalOutcomeMutationVariables, TContext>;
export declare const getGetCommunityImpactUrl: () => string;
export declare const getCommunityImpact: (options?: Parameters<typeof customFetch>[1]) => Promise<JsonResult>;
export declare const getGetCommunityImpactQueryKey: () => readonly ["/api/impact"];
export declare const getGetCommunityImpactQueryOptions: <TData = Awaited<ReturnType<typeof getCommunityImpact>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCommunityImpact>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCommunityImpact>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetCommunityImpactQueryResult = NonNullable<Awaited<ReturnType<typeof getCommunityImpact>>>;
export type GetCommunityImpactQueryError = ErrorType<unknown>;
export declare function useGetCommunityImpact<TData = Awaited<ReturnType<typeof getCommunityImpact>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCommunityImpact>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getCommunityImpact>>, TError, Awaited<ReturnType<typeof getCommunityImpact>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetCommunityImpact<TData = Awaited<ReturnType<typeof getCommunityImpact>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCommunityImpact>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getCommunityImpact>>, TError, Awaited<ReturnType<typeof getCommunityImpact>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetCommunityImpact<TData = Awaited<ReturnType<typeof getCommunityImpact>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCommunityImpact>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof healthCheck>>, TError, Awaited<ReturnType<typeof healthCheck>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof healthCheck>>, TError, Awaited<ReturnType<typeof healthCheck>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export {};
//# sourceMappingURL=api.d.ts.map