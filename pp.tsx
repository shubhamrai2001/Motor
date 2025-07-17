/* eslint-disable */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ProductGrid.css'; // Custom CSS
import { getProductList } from 'services/client';
import { useDispatch, useSelector } from 'react-redux';
import { ProductSearchFilter } from 'components/AddProduct/types/product.search.filters';
import { setLoading } from 'store/slices/subMenuSlice';
import { GridReadyEvent, SortModelItem } from 'ag-grid-community';
import Modal from './modal/Modal';

const rowLimit = 100;

interface Data {
    productTitle?: string;
    sku?: string;
    productType?: string;
    effectiveDate?: string;
    expirationDate?: string;
    revisionDate?: string;
    displayStock?: string;
    price?: number;
    productDescription?: string;
}

export interface SearchedProduct {
    type: string;
    productid: number;
    isEDelivery: boolean;
    inventoryID: number;
    isStatekit: boolean;
    isCustomKit: boolean;
    inlineSKU: string;
    isIDCard: boolean;
    isInline: boolean;
    isPublicOrderingEnabled: boolean;
    allowAddMultipleCustomkit: boolean;
    thumbnailFileID: number;
    maxOrder: number;
    mC1ProductType: string;
    isPostCard: boolean;
    productShortDescription: string;
    isMC1Registered: boolean;
    productDescription: string;
    isBRE: boolean;
    serialNo: string;
    revisionDate: string; // Assuming date is in ISO string format
    isStocked: boolean;
    expirationDate: string; // Assuming date is in ISO string format
    effectiveDate: string; // Assuming date is in ISO string format
    isBackOrdered: boolean;
    isRequiredApproval: boolean;
    isSelfMailer: boolean;
    isVisibleInLibrary: boolean;
    IsSubscriptionEnabled: boolean;
    isEmail: boolean;
    IsUID: boolean;
    clientCode: string;
    productType: string;
    productTypeDisplay: string;
    isHardCopy: boolean;
    productTitle: string;
    sku: string;
    isfax?: boolean;
    mC1Orderable: boolean;
    price: number;
    keywords: string;
    favorites: string[]; // Assuming favorites is an array of any type
    subscribeQty: number;
    displayStock?: string;
}

interface CounterState {
    selectedSubMenu: string;
    productLoading: boolean;
}

interface ClientInfo {
    clientName: string;
}
const ProductGrid = ({
    filter,
    onFilterChange,
}: {
    filter: ProductSearchFilter;
    onFilterChange: (updatedFilter: ProductSearchFilter) => void;
}) => {
    const filters = useSelector((state: any) => state.productFilters.filters);
    const filterRef = useRef(null);
    // Default column properties
    const defaultColDef = {
        sortable: false,
        filter: false,
        resizable: false,
        flex: 1,
    };
    const [modalOpened, setModalOpened] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<SearchedProduct | null>(null);
    const [hasNoData, setHasNoData] = useState(true);
    const { clientName } = useSelector((state: { client: ClientInfo }) => state.client);
    const dispatch = useDispatch();
    const { productLoading } = useSelector((state: { subMenu: CounterState }) => state.subMenu);
    console.log('Filter object passed:', filter, '\n', clientName, '\n', productLoading);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gridRef = useRef<AgGridReact<any> | null>(null);
    const currentPage = useRef<number>(filter.page);
    const pageSize = useRef<number>(filter.pageSize); // total pages
    const totalRows = useRef<number>(0);
    const totalPages = useRef<number>(0);
    const modalRef = useRef(null);
    const [stats, setStats] = useState<{
        cuPage: number;
        pageSize: number;
        totalRows: number;
        totPages: number;
    }>({ cuPage: 0, totalRows: 0, pageSize: 20, totPages: 0 });

    const getIconType = (fileType: string) => {
        switch (fileType) {
            case 'zip':
                return <brml-icon name='file-zip' size='sm' class='wf-icon' proto='icon'></brml-icon>;
            case 'docx':
                return <brml-icon name='docx-file' size='sm' class='wf-icon' proto='icon'></brml-icon>;
            case 'doc':
                return <brml-icon name='file-doc' size='sm' class='wf-icon' proto='icon'></brml-icon>;
            case 'jpg':
                return <brml-icon name='jpg-file' size='sm' class='wf-icon' proto='icon'></brml-icon>;
            case 'png':
                return <brml-icon name='png-file' size='sm' class='wf-icon' proto='icon'></brml-icon>;
            case 'link':
                return <brml-icon name='new-tab' size='sm' class='wf-icon' proto='icon'></brml-icon>;
            default:
                return <brml-icon name='Acrobat-pdf' size='sm' class='wf-icon' proto='icon'></brml-icon>;
        }
    };

    // Column definitions
    const [columnDefs] = useState([
        {
            headerName: 'SKU',
            field: 'sku',
            sortable: true,
            filter: false,
            cellRenderer: (params: { value: string }) => {
                return (
                    <a href='#' target='_blank' id='productSKU'>
                        {params.value}
                    </a>
                );
            },
            width: 100,
        },
        { headerName: 'Product Title', field: 'productTitle', sortable: true, width: 200, flex: 2 },
        {
            headerName: 'Product Type',
            field: 'productTypeDisplay',
            sortable: true,
            cellRenderer: 'iconRenderer',
            width: 140,
        },
        {
            headerName: '',
            field: 'productTypeDisplay',
            sortable: false,
            maxWidth: 40,
            cellRenderer: (params: { value: string }) => {
                if (params.value === 'Custom Kit' || params.value === 'State Kit') {
                    return (
                        <brml-tooltip text='a kit product variation' type='warning'>
                            <brml-icon name='info-tooltip' size='sm' class='wf-icon' proto='icon'></brml-icon>
                        </brml-tooltip>
                    );
                } else {
                    return <></>;
                }
            },
        },
        {
            headerName: 'Revision Date',
            field: 'revisionDate',
            sortable: true,
            width: 120,
            cellRenderer: (params: { value: string }) => {
                if (!params.value) return '';
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const dateParts: string[] = params.value?.split('-');
                if (dateParts.length === 3) {
                    const year = dateParts[0]?.slice(-2);
                    const day = dateParts[2]?.split('T')[0];
                    const formattedDate = `${dateParts[1]}/${day}/${year}`;
                    return formattedDate;
                }
                return params.value;
            },
        },
        { headerName: 'Stock', field: 'displayStock', sortable: true, width: 60 },
        {
            headerName: 'Actions',
            field: 'fileDescriptors',
            cellRenderer: (params: { data: SearchedProduct }) => (
                <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '8px' }}>
                    <brml-icon
                        name='view'
                        size='sm'
                        class='wf-icon'
                        proto='icon'
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                            console.log('Opening modal for product:', params.data.sku);
                            setSelectedProduct(params.data);
                            setModalOpened(true);
                        }}
                    />
                </div>
            ),
            suppressMenu: true,
            sortable: false,
            filter: false,
            maxWidth: 120,
        },
    ]);

    useEffect(() => {
        filterRef.current = filters
    }, [filters])
    const calculateSortingOrder = (sortModel: SortModelItem[]): number => {
        let sortOrder = 1; // default for sku and ASC
        if (sortModel.length > 0) {
            const sorting = sortModel[0];
            switch (sorting?.colId) {
                case 'sku':
                    return (sortOrder = sorting.sort === 'asc' ? 1 : 2);
                case 'productTitle':
                    return (sortOrder = sorting.sort === 'asc' ? 3 : 4);
                case 'productTypeDisplay':
                    return (sortOrder = sorting.sort === 'asc' ? 5 : 6);
                case 'revisionDate':
                    return (sortOrder = sorting.sort === 'asc' ? 7 : 8);
                case 'displayStock':
                    return (sortOrder = sorting.sort === 'asc' ? 9 : 10);
                default:
                    return sortOrder;
            }
        }
        return sortOrder;
    };

    const createDataSource = useMemo(
        () => ({
            getRows(params: {
                successCallback: (rows: SearchedProduct[], rowCount: number) => void;
                sortModel: SortModelItem[];
            }) {
                setTimeout(() => {
                    const sortModel = params.sortModel;
                    let sort = calculateSortingOrder(sortModel);
                    dispatch(setLoading(true));
                    const cleanedFilters = Object.fromEntries(
                        Object.entries(filters).filter(([key, value]) =>
                            value !== '' && value !== false && value !== null
                        )
                    );
                    const transformedFilters = Object.fromEntries(
                        Object.entries(cleanedFilters).map(([key, val]) => {
                            if (
                                Array.isArray(val) &&
                                val.length === 1 &&
                                typeof val[0] === "object" &&
                                "values" in val[0]
                            ) {
                                if (key === "productManager") {
                                    const ids = val[0].values.map((v: string) => v.match(/\b\d+\b/)?.[0]).filter(Boolean);
                                    console.log(`Extracted productManager IDs from nested:`, ids);
                                    return [key, ids.join(", ")];
                                }
                                console.log(`Flattened nested array with 'values' for ${key}:`, val[0].values);
                                return [key, val[0].values.join(", ")];
                            }

                            if (Array.isArray(val)) {
                                if (key === "productManager") {
                                    const ids = val.map((v: string) => v.match(/\b\d+\b/)?.[0]).filter(Boolean);
                                    console.log(`Extracted productManager IDs:`, ids);
                                    return [key, ids.join(", ")];
                                }
                                console.log(`Joined array for ${key}:`, val);
                                return [key, val.join(", ")];
                            }

                            console.log(`Kept value as-is for ${key}:`, val);
                            return [key, val];
                        })
                    );

                    console.log("Final transformedFilters:", transformedFilters);

                    getProductList({
                        ...transformedFilters, clientCode: clientName, pageSize: pageSize.current, page: currentPage.current, sort,
                        keywords: filter.productDesc || filter.productTitle || ''
                    }).then(
                        (products: { data: { data: SearchedProduct[]; totalRecords: number } }) => {
                            console.log(" API Response:", products);
                            dispatch(setLoading(false));
                            totalRows.current = products?.data?.totalRecords;
                            setHasNoData(products?.data?.totalRecords === 0);
                            params.successCallback(products?.data?.data, products?.data?.totalRecords);
                        }
                    );
                }, 500);
            },
        }),
        [clientName, filters]
    );

    // Pagination event handler
    const onPaginationChanged = useCallback(() => {
        if (gridRef.current && gridRef.current.api) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            const currPage = gridRef.current.api.paginationGetCurrentPage() + 1;
            const size: number = gridRef.current.api.paginationGetPageSize();
            const totPages = gridRef.current.api.paginationGetTotalPages();
            const totRows = gridRef.current.api.paginationGetRowCount();
            currentPage.current = currPage;
            pageSize.current = size;
            totalRows.current = totRows;
            totalPages.current = totPages;

            onFilterChange({
                ...filter,
                pageSize: pageSize.current,
                page: totalPages.current,
                clientCode: clientName,
            });
            setStats({ ...stats, pageSize: size, cuPage: currPage, totalRows: totRows, totPages });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, clientName, onFilterChange]);

    return (
        <div
            className='custom-grid'
            style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header Section */}
            <div
                style={{
                    backgroundColor: 'rgba(0,0,0,0)',
                    position: 'absolute',
                    top: '60px',
                    zIndex: '100',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                {productLoading ? (
                    <div className='loader'>
                        <Loading />
                    </div>
                ) : hasNoData ? (
                    <div className='customMessage'>
                        {!filter.keywords
                            ? 'There is no data for this client. Please select other client.'
                            : `We couldn't find any matches for "${filter.keywords}". Try adjusting your search or filters.`}
                    </div>
                ) : null}
            </div>{' '}
            {totalRows.current > rowLimit && filter.keywords && <SearchLimitWarning />}{' '}
            <Modal
                opened={modalOpened}
                data={selectedProduct || {}}
                onClose={() => {
                    console.log('Modal closing, resetting state');
                    setModalOpened(false);
                    setSelectedProduct(null);
                }}
            />
            <div
                className='ag-theme-alternating-rows'
                style={{
                    flex: 1,
                    width: '100%',
                    overflow: 'hidden',
                    // display: hasNoData ? 'none' : 'block',
                }}>
                <AgGridReact
                    ref={gridRef}
                    datasource={createDataSource}
                    rowModelType='infinite'
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    pagination
                    domLayout='autoHeight'
                    paginationPageSize={pageSize.current}
                    cacheBlockSize={pageSize.current}
                    onPaginationChanged={onPaginationChanged}
                    className='ag-theme-brml-new style-striped adjust-top-spacing'
                />
            </div>
        </div>
    );
};

export default ProductGrid;

function Loading() {
    return (
        <div
            style={{
                width: '100vw',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'white',
            }}>
            <brml-icon name='Loader' size='xxs' style={{ transform: 'scale(0.2)' }}></brml-icon>
            <p>Please wait while this content loads</p>
        </div>
    );
}

function SearchLimitWarning() {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div
            style={{
                width: '60vw',
                position: 'absolute',
                zIndex: '200',
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: '#EAF4FF',
                border: '1px solid #0B49EA',
                borderRadius: '4px',
                gap: '8px',
                margin: '-213px auto',
                alignSelf: 'center',
            }}>
            <brml-icon name='status-information' size='sm' style={{ color: '#0B49EA' }} />
            <div>
                <strong>Search Results</strong>
                <p style={{ margin: '0' }}>
                    The search criteria are too broad. To help you find the most relevant items, we're only
                    showing the first {rowLimit}. Try refining your search or applying filters.
                </p>
            </div>
            <button
                style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                }}
                onClick={() => setIsVisible(false)}
                aria-label='Close warning'>
                <brml-icon name='close' size='xs' />
            </button>
        </div>
    );
}