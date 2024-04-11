import _ from "lodash";
import {Model} from "./base/Model";
import {dayjs, formatNumber} from "../utils/utils";
import { FormErrors, IOrder, IAppState, ILot, LotStatus, IOrderForm } from "../types";


export type CatalogChangeEvent = {
    catalog: LotItem[]
};

export class LotItem extends Model<ILot> {
    about: string;
    description: string;
    id: string;
    image: string;
    title: string;
    datetime: string;
    history: number[];
    minPrice: number;
    price: number;
    status: LotStatus;

    protected myLastBid: number = 0;

    // отчистка цены
    clearBid() {
        this.myLastBid = 0;
    }

    // устанавливаем цену
    placeBid(price: number): void {
        this.price = price;
        this.history = [...this.history.slice(1), price];
        this.myLastBid = price;

        if (price > (this.minPrice * 10)) {
            this.status = 'closed';
        }
        this.emitChanges('auction:changed', {id: this.id, price});
    }

    get isMyBid(): boolean {
        return this.myLastBid === this.price;
    }

    get isParticipate(): boolean {
        return this.myLastBid !== 0;
    }

    // статус лота
    get statusLabel(): string {
        switch(this.status) {
            case "active":
                return `Открыто до ${dayjs(this.datetime).format('D MMMM [в] HH:mm')}`
            case "closed":
                return `Закрыто ${dayjs(this.datetime).format('D MMMM [в] HH:mm')}`
            case "wait":
                return `Откроется ${dayjs(this.datetime).format('D MMMM [в] HH:mm')}`
            default:
                return this.status;
        }
    }

    // время лота
    get timeStatus(): string {
        if (this.status === 'closed') return 'Аукцион завершен';
        else return dayjs
            .duration(dayjs(this.datetime).valueOf() - Date.now())
            .format('D[д] H[ч] m[ мин] s[ сек]');
    }

    // статус аукциона
    get auctionStatus(): string {
        switch (this.status) {
            case 'closed':
                return `Продано за ${formatNumber(this.price)}₽`;
            case 'wait':
                return 'До начала аукциона';
            case 'active':
                return 'До закрытия лота';
            default:
                return '';
        }
    }

    // предложение ставки
    get nextBid() {
        return Math.floor(this.price * 1.1);
    }
}

export class AppState extends Model<IAppState> {
    basket: string[];
    catalog: LotItem[];
    loading: boolean;
    order: IOrder = {
        email: '',
        phone: '',
        items: []
    };
    preview: string | null;
    formErrors: FormErrors = {};

    toggleOrderedLot(id: string, isIncluded: boolean) {
        if (isIncluded) {
            this.order.items = _.uniq([...this.order.items, id]);
        } else {
            this.order.items = _.without(this.order.items, id);
        }
    }

    clearBasket() {
        this.order.items.forEach(id => {
            this.toggleOrderedLot(id, false);
            this.catalog.find(it => it.id === id).clearBid();
        })
    }

    // итоговая сумма в корзине
    getTotal() {
        return this.order.items.reduce((a, c) => a + this.catalog.find(it => it.id === c).price, 0);
    }

    // устанавливаем лоты
    setCatalog(items: ILot[]) {
        this.catalog = items.map(item => new LotItem(item, this.events));
        this.emitChanges('items:changed', { catalog: this.catalog} );
    }

    // устанавливаем превью
    setPreview(item: LotItem) {
        this.preview = item.id;
        this.emitChanges('preview:changed', item);
    }

    // выбранные лоты
    getActiveLots(): LotItem[] {
        return this.catalog
            .filter(item => item.status === 'active' && item.isParticipate);
    }

    getClosedLots(): LotItem[] {
        return this.catalog
            .filter(item => item.status === 'closed' && item.isMyBid);
    }

    // оформление ставки
    setOrderField(field: keyof IOrderForm, value: string) {
        this.order[field] = value;

        if (this.validateOrder()) {
            this.events.emit('order:ready', this.order);
        }
    }

    // валидация формы заказа, проверяет, есть ли ошибки
    validateOrder() {
        const errors: typeof this.formErrors ={};
        if (!this.order.email) {
            errors.email = 'Необходимо указать email';
        }
        if (!this.order.phone) {
            errors.phone = 'Необходимо указать телефон';
        }
        this.formErrors = errors;
        this.events.emit('formErrors:change', this.formErrors);
        return Object.keys(errors).length === 0;
    }
}