import './scss/styles.scss';

import {AuctionAPI} from "./components/AuctionAPI";
import {API_URL, CDN_URL} from "./utils/constants";
import {EventEmitter} from "./components/base/events";
import { AppState, CatalogChangeEvent } from './components/AppData';
import { Page } from './components/Page';
import { CatalogItem } from './components/Card';
import { Modal } from './components/common/Modal';
import { cloneTemplate, ensureElement } from './utils/utils';

const events = new EventEmitter();
const api = new AuctionAPI(CDN_URL, API_URL);

// Чтобы мониторить все события, для отладки
events.onAll(({ eventName, data }) => {
    console.log(eventName, data);
})

// Все шаблоны
const cardCatalogTemplate = ensureElement<HTMLTemplateElement>('#card');

// Модель данных приложения
const appData = new AppState({}, events);

// Глобальные контейнеры
const page = new Page(document.body, events);
const modal = new Modal(ensureElement<HTMLElement>('#modal-container'), events);

// Переиспользуемые части интерфейса


// Дальше идет бизнес-логика
// Поймали событие, сделали что нужно
events.on<CatalogChangeEvent>('items:changed', () => {
    page.catalog = appData.catalog.map(item => {
        const card = new CatalogItem(cloneTemplate(cardCatalogTemplate), {
            onClick: () => events.emit('card:select', item)
        })

        // отрисовалась карточка
        return card.render({
            title: item.title,
            image: item.image,
            description: item.about,
            status: {
                status: item.status,
                label: item.statusLabel
            },
        });
    })
})

// Получаем лоты с сервера
api.getLotList()
    // .then(result => {
    //     // вместо лога поместите данные в модель
    //     // console.log(result);
        
    // })
    .then(appData.setCatalog.bind(appData))
    .catch(err => {
        console.error(err);
    });


